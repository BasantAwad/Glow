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
                        
                if name in ["default_api:write_to_file", "write_to_file", "default_api:replace_file_content", "replace_file_content", "default_api:multi_replace_file_content", "multi_replace_file_content"]:
                    target_file = args.get("TargetFile", args.get("AbsolutePath", ""))
                    
                    # For write_to_file, we get CodeContent
                    if name.endswith("write_to_file"):
                        content = args.get("CodeContent", "")
                        if target_file and content:
                            norm = os.path.normpath(target_file).lower()
                            files[norm] = (target_file, content)
                            
                    # For replace_file_content, we can't easily replay without the original, 
                    # but maybe we can just catch write_to_file which is how they were created
                    
for norm, (path, content) in files.items():
    if "apps\\api\\src\\glow_api" in norm and norm.endswith(".py"):
        print(f"Recovering {path}")
        with open(path, 'w', encoding='utf-8') as out:
            out.write(content)

count = len([k for k in files if "apps\\\\api\\\\src\\\\glow_api" in k and k.endswith(".py")])
print(f"Recovered {count} files.")
