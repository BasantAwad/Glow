import json
import os
from pathlib import Path

transcript_path = Path(r"C:\Users\Pc\.gemini\antigravity-ide\brain\cfbc640b-502e-4641-b35c-78cd051eacc3\.system_generated\logs\transcript_full.jsonl")

files = {}

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            entry = json.loads(line)
        except Exception:
            continue
            
        if "tool_calls" in entry:
            for tc in entry["tool_calls"]:
                name = tc.get("name", tc.get("function", {}).get("name", ""))
                args = tc.get("arguments", tc.get("args", {}))
                
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        continue
                        
                if name.endswith("write_to_file"):
                    target_file = args.get("TargetFile", args.get("AbsolutePath", ""))
                    content = args.get("CodeContent", "")
                    if target_file and content:
                        norm = os.path.normpath(target_file).lower()
                        if "apps\\api\\src\\glow_api" in norm and norm.endswith(".py"):
                            files[norm] = (target_file, content)
                            
                elif name.endswith("replace_file_content"):
                    target_file = args.get("TargetFile", "")
                    if target_file:
                        norm = os.path.normpath(target_file).lower()
                        if norm in files:
                            orig_path, current_content = files[norm]
                            target_content = args.get("TargetContent", "")
                            replacement = args.get("ReplacementContent", "")
                            if target_content in current_content:
                                current_content = current_content.replace(target_content, replacement, 1)
                                files[norm] = (orig_path, current_content)

                elif name.endswith("multi_replace_file_content"):
                    target_file = args.get("TargetFile", "")
                    if target_file:
                        norm = os.path.normpath(target_file).lower()
                        if norm in files:
                            orig_path, current_content = files[norm]
                            chunks = args.get("ReplacementChunks", [])
                            for chunk in chunks:
                                target_content = chunk.get("TargetContent", "")
                                replacement = chunk.get("ReplacementContent", "")
                                if target_content in current_content:
                                    current_content = current_content.replace(target_content, replacement, 1)
                            files[norm] = (orig_path, current_content)

for norm, (path, content) in files.items():
    if "apps\\api\\src\\glow_api" in norm and norm.endswith(".py"):
        with open(path, 'w', encoding='utf-8') as out:
            out.write(content)

print(f"Replayed {len(files)} files with full diff history!")
