import os

files_to_modify = ['CardF1.dc.html', 'Main.dc.html']

for filename in files_to_modify:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Revert dot position back to right
        content = content.replace('top: 6px; left: 6px;', 'top: 6px; right: 6px;')
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)

print("Reverted dot position.")
