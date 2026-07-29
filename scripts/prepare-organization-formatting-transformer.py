from pathlib import Path

path = Path(__file__).with_name('apply-organization-formatting.py')
text = path.read_text()
block = '''replace(
    "src/components/reports/reports-section.tsx",
    "formatter={(value) => `$${Number(value).toLocaleString()}`}",
    "formatter={(value) => formatCurrency(Number(value))}",
)
'''

first = text.find(block)
if first < 0:
    raise RuntimeError('Expected report formatter replacement block was not found.')

cursor = first + len(block)
while True:
    duplicate = text.find(block, cursor)
    if duplicate < 0:
        break
    text = text[:duplicate] + text[duplicate + len(block):]

path.write_text(text)
