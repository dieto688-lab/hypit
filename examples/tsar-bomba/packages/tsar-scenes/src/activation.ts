import { assertAttributes, assertEmptyElement, createMarkupSurfaceFacet, textAttribute } from "@hypit/hypit/markup";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { canonicalize, sameType } from "@hypit/hypit/protocol";
import { sealGraphFragment } from "@hypit/hypit/author";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { FragmentOperation } from "@hypit/hypit/author";
import type { ModuleManifest, TypeRef } from "@hypit/hypit/protocol";
import type { StructuredSurfaceHandler, SurfaceResolvedReference } from "@hypit/hypit/markup";
import { compositionTypes } from "@hypit/composition";
import { mediaTypes } from "@hypit/media";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import { timelineTypes } from "@hypit/timeline";
import { spatialTypes } from "@hypit/spatial";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor, temporalTypes } from "@hypit/temporal";
import type { TemporalWindow } from "@hypit/temporal";
import { resolveTemporalWindowReference, resolveTemporalContext,
  temporalContextAttributeVocabulary, temporalWindowAttributeNames, temporalWindowAttributeVocabulary } from "@hypit/temporal/markup";
import { renderScenes, SCENE_KINDS } from "./render.js";
import type { SceneData, ScenesOptions } from "./render.js";

const module = { name: "@example/tsar-scenes", version: "1" } as const;
const types = Object.fromEntries(["Options", "Scene", "Scenes"].map(name => [name, { module, name }])) as Record<"Options" | "Scene" | "Scenes", TypeRef>;
const producers = Object.fromEntries(["empty", "append", "render"].map(name => [name, { module, name }])) as Record<"empty" | "append" | "render", { module: typeof module; name: string }>;
export const manifest: ModuleManifest = { format: "hypit.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, mediaTypes.fontStack, timelineTypes.timeline, spatialTypes.frame, temporalTypes.window].map(type => ({ module: type.module })),
  types: Object.values(types).map(type => ({ name: type.name })), capabilities: [], producers: [
    { name: "empty", inputs: [], outputs: [{ name: "scenes", type: types.Scenes }], needs: [] },
    { name: "append", inputs: [{ name: "scenes", type: types.Scenes }, { name: "scene", type: types.Scene },
      { name: "window", type: temporalTypes.window }, { name: "timeline", type: timelineTypes.timeline }], outputs: [{ name: "scenes", type: types.Scenes }], needs: [] },
    { name: "render", inputs: [{ name: "scenes", type: types.Scenes }, { name: "options", type: types.Options },
      { name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
      { name: "window", type: temporalTypes.window }, { name: "font", type: mediaTypes.fontStack }], outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] },
  ],
};
const inline = <T>(record: { value: { kind: string; value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("Scenes inputs must be inline values.");
  return record.value.value as T;
};
const value = (data: unknown) => ({ kind: "inline" as const, value: canonicalize(data) });
const component: ProducerPackage & AdmissionPackage = { producers: [
  { producer: producers.empty, handler: () => ({ outputs: { scenes: value([]) }, needs: {} }) },
  { producer: producers.append, handler: ({ inputs }) => {
    const scene = inline<Omit<SceneData, "window">>(inputs.scene), window = inline<TemporalWindow>(inputs.window);
    const scenes = inline<SceneData[]>(inputs.scenes);
    assertTemporalWindowFor(window, { subjectId: scene.id, timeline: inline<Timeline>(inputs.timeline) });
    if (scenes.some(item => item.id === scene.id)) throw new Error("Scene ids must be unique.");
    return { outputs: { scenes: value([...scenes, { ...scene, window }]) }, needs: {} };
  } },
  { producer: producers.render, handler: ({ inputs }) => ({ outputs: { visual: value(renderScenes(inline<Timeline>(inputs.timeline),
    inline<SpatialFrame>(inputs.within), inline<TemporalWindow>(inputs.window), inline<FontStackRef>(inputs.font),
    inline<SceneData[]>(inputs.scenes), inline<ScenesOptions>(inputs.options))) }, needs: {} }) },
] };

export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "within", "font", "caption-size", ...temporalWindowAttributeNames]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const window = resolveTemporalWindowReference({ element, resolveReference });
  const reference = (name: string, type: TypeRef): SurfaceResolvedReference => {
    const raw = element.attributes[name];
    if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${name} must be a reference.`);
    const found = resolveReference(raw.path);
    if (found === undefined || !sameType(found.type, type)) throw new Error(`${name} has the wrong Type.`);
    return found;
  };
  const options: ScenesOptions = { id, captionSize: Number(element.attributes["caption-size"] ?? "54") };
  const records = [{ id: `${id}.options`, type: types.Options, value: value(options), range: element.range }];
  const inputs = [{ name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
    { name: "font", type: mediaTypes.fontStack }, { name: "window", type: temporalTypes.window }, { name: "options", type: types.Options }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref, within: reference("within", spatialTypes.frame).ref,
    font: reference("font", mediaTypes.fontStack).ref, window: window.ref, options: { kind: "record", id: `${id}.options` } };
  const input = (name: string) => ({ kind: "fragment-input" as const, name });
  const operation = (name: string) => ({ kind: "fragment-operation" as const, operation: name });
  const operations: FragmentOperation[] = [{ id: "empty", producer: producers.empty, inputs: {}, result: { kind: "output", name: "scenes" } }];
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Scenes accepts Scene children."); continue; }
    if (child.name.split(":").at(-1) !== "Scene") throw new Error("Scenes accepts Scene children.");
    assertAttributes(child, ["id", "kind", "caption", ...temporalWindowAttributeNames]); assertEmptyElement(child);
    const sceneId = textAttribute(child, "id"), kind = textAttribute(child, "kind");
    if (!(SCENE_KINDS as readonly string[]).includes(kind)) throw new Error(`Scene kind must be one of ${SCENE_KINDS.join(", ")}.`);
    const sceneWindow = resolveTemporalWindowReference({ element: child, resolveReference });
    const key = `scene-${++index}`;
    records.push({ id: `${id}.${key}`, type: types.Scene, value: value({ id: sceneId, kind, caption: textAttribute(child, "caption") }), range: child.range });
    inputs.push({ name: key, type: types.Scene }, { name: `${key}-window`, type: temporalTypes.window });
    bindings[key] = { kind: "record", id: `${id}.${key}` }; bindings[`${key}-window`] = sceneWindow.ref;
    operations.push({ id: key, producer: producers.append, inputs: { scenes: operation(previous), scene: input(key), window: input(`${key}-window`), timeline: input("timeline") }, result: { kind: "output", name: "scenes" } });
    previous = key;
  }
  if (!index) throw new Error("Scenes requires a Scene.");
  operations.push({ id: "render", producer: producers.render, inputs: { scenes: operation(previous), options: input("options"),
    timeline: input("timeline"), within: input("within"), font: input("font"), window: input("window") }, result: { kind: "output", name: "visual" } });
  const fragment = sealGraphFragment({ inputs, operations, exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("render") }] });
  return { records, fragments: [fragment], components:
    [{ id, fragment: fragment.id, inputs: bindings, outputs: { visual: `${id}.visual` }, range: element.range }], exports: [`${id}.visual`] };
};
const declaration = { name: "scenes", tag: "Scenes", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, ...Object.values(types)],
  vocabulary: { summary: "Seven authored explainer scenes with phrase captions, timed by absolute windows.",
    attributes: [
      ...temporalContextAttributeVocabulary, ...temporalWindowAttributeVocabulary,
      ...["id", "within", "font"].map(name => ({ name, kind: "expression" as const, required: true, summary: name })),
      { name: "caption-size", kind: "literal" as const, required: false, summary: "Caption font size in px; defaults to 54." },
    ],
    children: [{ tag: "Scene", cardinality: "many" as const, summary: "One scene kind, its window and ||-separated caption phrases.", attributes: [
      ...["id", "kind", "caption"].map(name => ({ name, kind: "literal" as const, required: true, summary: name })), ...temporalWindowAttributeVocabulary,
    ] }], ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The complete scene sequence." }],
    example: '<tsar:Scenes id="scenes" timeline={program.timeline} within={canvas.bounds} font={font} during={program.window}><tsar:Scene id="s1" kind="hook" during={program.s1} caption="Phrase one || Phrase two"/></tsar:Scenes>',
  },
};
export const hypitPackage = { format: "hypit.package@1" as const, modules: [{ manifest }],
  facets: [createProducerPackageFacet(component), createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module, declaration, handler: decodeSurface })] };
export default hypitPackage;
