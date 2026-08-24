import os

for r, d, files in os.walk(r'c:\Users\Pc\Desktop\Glow\apps\api\src\glow_api'):
    for f in files:
        if f.endswith('.py'):
            path = os.path.join(r, f)
            with open(path, 'r', encoding='utf-8') as file:
                data = file.read()
            
            data = data.replace('from typing import Annotated', 'from typing_extensions import Annotated')
            data = data.replace('from typing import Any, Annotated', 'from typing import Any\nfrom typing_extensions import Annotated')
            data = data.replace('from typing import Annotated, Any', 'from typing import Any\nfrom typing_extensions import Annotated')
            
            with open(path, 'w', encoding='utf-8') as file:
                file.write(data)
