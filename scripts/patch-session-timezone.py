from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/lib/server-session.ts'
text = path.read_text()
old = """    currency: membership.organization.currency,
    locale: membership.organization.locale,
"""
new = """    currency: membership.organization.currency,
    locale: membership.organization.locale,
    timezone: membership.organization.timezone,
"""
if old not in text:
    raise RuntimeError('Expected fresh-session organization fields were not found.')
path.write_text(text.replace(old, new))
