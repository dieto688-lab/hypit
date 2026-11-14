#!/tmp/venv/bin/python
"""Minimal ffprobe-compatible probe shim backed by PyAV.

Hypit's local media providers invoke `ffprobe` with a small set of argument
shapes (full inspection with frames, entry-filtered probes, frame counting and
`-version`). This shim implements those shapes by decoding with PyAV and
emitting ffprobe-shaped JSON. It is a sandbox stand-in for a real ffprobe
binary; on a normal machine, point the Runtime at a real ffprobe instead.

Usage: ffprobe-shim [-version] [-v error] [-print_format json] [-show_format]
  [-show_streams] [-show_frames] [-count_frames] [-select_streams v:0]
  [-show_entries ...] [-of json] <input>
"""
import json
import sys
from fractions import Fraction


def fmt_frac(value):
    if value is None:
        return "0/0"
    try:
        frac = Fraction(value)
    except Exception:
        return "0/0"
    return f"{frac.numerator}/{frac.denominator}"


def parse_args(argv):
    show_frames = "-show_frames" in argv
    count_frames = "-count_frames" in argv
    select_v0 = False
    value_flags = {"-of", "-show_entries", "-select_streams", "-v", "-print_format"}
    input_path = None
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in value_flags:
            if arg == "-select_streams" and i + 1 < len(argv) and argv[i + 1] == "v:0":
                select_v0 = True
            i += 2
            continue
        if arg.startswith("-"):
            i += 1
            continue
        input_path = arg
        i += 1
    return show_frames, count_frames, select_v0, input_path


def main():
    argv = sys.argv[1:]
    if "-version" in argv:
        print("ffprobe version 6.1 (PyAV shim)")
        return 0
    show_frames, count_frames, select_v0, input_path = parse_args(argv)
    if input_path is None:
        print("ffprobe shim: no input file", file=sys.stderr)
        return 1
    import av

    container = av.open(input_path)
    streams_out = []
    seen_types = set()
    for idx, stream in enumerate(container.streams):
        stype = stream.type
        if stype not in ("video", "audio", "subtitle", "data", "attachment"):
            stype = "unknown"
        st = {"index": idx, "codec_type": stype}
        try:
            st["codec_name"] = stream.codec_context.name or "unknown"
        except Exception:
            st["codec_name"] = "unknown"
        tb = stream.time_base
        st["time_base"] = fmt_frac(tb) if tb is not None else "1/1000000"
        is_first_of_type = stype not in seen_types
        seen_types.add(stype)
        st["disposition"] = {"default": 1 if is_first_of_type else 0, "attached_pic": 0}
        if stype == "video":
            st["width"] = int(stream.width or 0)
            st["height"] = int(stream.height or 0)
            st["sample_aspect_ratio"] = "1:1"
            st["avg_frame_rate"] = fmt_frac(stream.average_rate) if stream.average_rate else "0/0"
            st["r_frame_rate"] = fmt_frac(stream.base_rate) if stream.base_rate else "0/0"
            try:
                transfer = stream.codec_context.color_transfer
                if transfer:
                    st["color_transfer"] = str(transfer)
            except Exception:
                pass
        if stype == "audio":
            try:
                st["sample_rate"] = str(int(stream.codec_context.sample_rate))
            except Exception:
                st["sample_rate"] = "48000"
            try:
                st["channels"] = int(stream.codec_context.channels)
            except Exception:
                st["channels"] = 2
            try:
                layout = stream.codec_context.layout
                if layout:
                    name = getattr(layout, "name", None)
                    if name:
                        st["channel_layout"] = str(name)
            except Exception:
                pass
        streams_out.append(st)

    frames_out = []
    if show_frames or count_frames:
        counts = {}
        max_end = 0.0
        for packet in container.demux():
            si = packet.stream.index
            tb = packet.stream.time_base
            for frame in packet.decode():
                counts[si] = counts.get(si, 0) + 1
                is_audio = isinstance(frame, av.AudioFrame)
                if show_frames:
                    entry = {"stream_index": si, "media_type": "audio" if is_audio else "video"}
                    if frame.pts is not None:
                        entry["pts"] = str(int(frame.pts))
                    if frame.duration is not None:
                        entry["duration"] = str(int(frame.duration))
                    if is_audio:
                        try:
                            entry["nb_samples"] = int(frame.samples)
                        except Exception:
                            pass
                    frames_out.append(entry)
                try:
                    if frame.pts is not None and frame.duration is not None and tb:
                        end = (int(frame.pts) + int(frame.duration)) * float(tb)
                        max_end = max(max_end, end)
                except Exception:
                    pass
        if count_frames:
            for st in streams_out:
                n = str(counts.get(st["index"], 0))
                st["nb_read_frames"] = n
                st["nb_frames"] = n

    fmt = {}
    try:
        fmt["format_name"] = container.format.name or "unknown"
    except Exception:
        fmt["format_name"] = "unknown"
    duration = container.duration
    if duration is not None:
        fmt["duration"] = str(duration / 1e6)
    elif frames_out:
        fmt["duration"] = str(max_end)
    else:
        fmt["duration"] = "0"

    out = {"streams": streams_out, "format": fmt}
    if show_frames:
        out["frames"] = frames_out
    if select_v0:
        out["streams"] = [s for s in streams_out if s["codec_type"] == "video"][:1]
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
