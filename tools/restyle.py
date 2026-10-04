import io

p = r'C:\Users\etc\Desktop\prototipo-pedidos\style.css'
s = io.open(p, encoding='utf8').read()
orig = s

R = [
# brand en Caveat + dorado, como el logo del repo de referencia
(""".brand-mark {
  width: 34px; height: 34px; border-radius: 9px; flex: none;
  background: linear-gradient(135deg, #6172f3, #444ce7);
  display: grid; place-items: center; font-weight: 700; font-size: 16px; color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 2px 6px rgba(68,76,231,.4);
}""",
""".brand-mark {
  width: 34px; height: 34px; border-radius: 9px; flex: none;
  background: linear-gradient(135deg, #c9a227, #8a6d14);
  display: grid; place-items: center; font-family: 'Caveat', cursive;
  font-weight: 700; font-size: 22px; line-height: 1; color: #fff8ee; padding-top: 2px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 2px 6px rgba(138,109,20,.4);
}"""),
(".brand-name { font-weight: 600; font-size: 14px; letter-spacing: -.01em; }",
 ".brand-name { font-family: 'Caveat', cursive; font-weight: 700; font-size: 22px; line-height: 1.1; color: #fff8ee; }"),
(".brand-sub { font-size: 11px; color: #667085; }",
 ".brand-sub { font-size: 10.5px; color: #c7b391; letter-spacing: .04em; }"),
(""".brand-tag {
  margin-left: auto; font-size: 9.5px; font-weight: 600; letter-spacing: .08em;
  color: #8b93a5; background: #1f242f; border: 1px solid #2a313f; border-radius: 99px; padding: 2px 7px;
}""",
""".brand-tag {
  margin-left: auto; font-size: 9.5px; font-weight: 600; letter-spacing: .08em;
  color: #d9c48f; background: transparent; border: 1px solid #6b543c; border-radius: 99px; padding: 2px 7px;
}"""),
(".nav a.active { background: linear-gradient(90deg, rgba(97,114,243,.18), rgba(97,114,243,.06)); color: #fff; }\n.nav a.active svg { color: #97a1f8; }",
 ".nav a.active { background: linear-gradient(90deg, rgba(201,162,39,.22), rgba(201,162,39,.06)); color: #fff; }\n.nav a.active svg { color: #d9b53a; }"),
(".nav a svg { color: #5f6776; }", ".nav a svg { color: #a3896a; }"),
(".nav a:hover { background: var(--sidebar-hover); color: #fff; }",
 ".nav a:hover { background: var(--sidebar-hover); color: #fff8ee; }"),
("  color: #b8bdc9; text-decoration: none; font-weight: 500; font-size: 13.5px;",
 "  color: #d8c7ab; text-decoration: none; font-weight: 500; font-size: 13.5px;"),
(".nav-label { font-size: 10.5px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: #535c6b; padding: 12px 8px 5px; }",
 ".nav-label { font-size: 10.5px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: #8a7355; padding: 12px 8px 5px; }"),
(".sidebar-foot { margin-top: auto; padding: 13px 16px; border-top: 1px solid var(--sidebar-line); font-size: 11.5px; color: #667085; }",
 ".sidebar-foot { margin-top: auto; padding: 13px 16px; border-top: 1px solid var(--sidebar-line); font-size: 11.5px; color: #a3896a; }"),
(".sidebar-foot a { color: #8591a8; text-decoration: none; display: block; margin-top: 2px; }",
 ".sidebar-foot a { color: #d9b53a; text-decoration: none; }"),
(".sidebar-foot a:hover { color: #c2c9d6; }", ".sidebar-foot a:hover { color: #f0d68a; }"),
# titulos display en Playfair
(".view-head h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -.02em; }",
 ".view-head h1 { margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 600; letter-spacing: -.01em; }"),
(".card-head h2 { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: -.01em; }",
 ".card-head h2 { margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 15.5px; font-weight: 600; }"),
(".modal h3 { margin: 12px 0 6px; font-size: 16px; letter-spacing: -.01em; }",
 ".modal h3 { margin: 12px 0 6px; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; }"),
# focos y acentos dorados
(".btn:focus-visible { outline: 2px solid var(--accent-ring); outline-offset: 1px; }",
 ".btn:focus-visible { outline: 2px solid var(--accent-ring); outline-offset: 1px; }\n.btn.primary { color: #fff8ee; }"),
(".field input:focus, .field select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }",
 ".field input:focus, .field select:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px var(--accent-ring); }"),
(".search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }",
 ".search:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px var(--accent-ring); }"),
(".pay-opt input { accent-color: var(--accent); margin: 0; }",
 ".pay-opt input { accent-color: var(--gold); margin: 0; }"),
(".pay-opt label:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }",
 ".pay-opt label:has(input:checked) { border-color: var(--gold); background: var(--gold-soft); color: var(--gold-text); }"),
(".mini-check input { accent-color: var(--accent); margin: 0; }",
 ".mini-check input { accent-color: var(--gold); margin: 0; }"),
# ficha KPI indigo -> gold
(".ic.indigo { background: var(--accent-soft); color: var(--accent); }",
 ".ic.gold { background: var(--gold-soft); color: var(--gold-text); }"),
# toasts marron + icono dorado
(".toast { display: flex; align-items: center; gap: 10px; background: #101828; color: #f2f4f7; padding: 10px 15px; border-radius: 10px; box-shadow: var(--shadow-3); font-size: 13px; animation: tin .18s ease; max-width: 380px; }\n.toast svg { color: #97a1f8; }",
 ".toast { display: flex; align-items: center; gap: 10px; background: #3b2a1d; color: #f5e8d3; padding: 10px 15px; border-radius: 10px; box-shadow: var(--shadow-3); font-size: 13px; animation: tin .18s ease; max-width: 380px; }\n.toast svg { color: #d9b53a; }"),
# superficies calidas
(".seg { display: inline-flex; background: #f2f4f7; border-radius: 9px; padding: 3px; gap: 2px; }",
 ".seg { display: inline-flex; background: #efe2c8; border-radius: 9px; padding: 3px; gap: 2px; }"),
(".seg button.on { background: #fff; color: var(--text); box-shadow: var(--shadow-1); font-weight: 600; }",
 ".seg button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1); font-weight: 600; }"),
(".table tbody tr:hover { background: #f9fafb; }", ".table tbody tr:hover { background: #f8efdd; }"),
(".stockbar .bar { width: 90px; height: 6px; border-radius: 99px; background: #eef0f4; overflow: hidden; }",
 ".stockbar .bar { width: 90px; height: 6px; border-radius: 99px; background: #efe2c8; overflow: hidden; }"),
(".stockbar .bar i { display: block; height: 100%; border-radius: 99px; background: var(--accent); }",
 ".stockbar .bar i { display: block; height: 100%; border-radius: 99px; background: var(--gold); }"),
(".modal { background: #fff; border-radius: 14px; box-shadow: var(--shadow-3); width: min(430px, 100%); padding: 24px; }",
 ".modal { background: var(--surface); border-radius: 14px; box-shadow: var(--shadow-3); width: min(430px, 100%); padding: 24px; }"),
(".modal .rows { margin: 12px 0; border: 1px solid var(--border-soft); border-radius: 10px; padding: 4px 14px; }",
 ".modal .rows { margin: 12px 0; border: 1px solid var(--border); border-radius: 10px; padding: 4px 14px; background: #fffdf7; }"),
# extras: fotos de producto y boton whatsapp
(".dbpre { max-height: 340px; overflow: auto; font-size: 12px; font-family: ui-monospace, \"Cascadia Code\", Consolas, monospace; white-space: pre; margin: 0; color: var(--text-2); }",
 ".dbpre { max-height: 340px; overflow: auto; font-size: 12px; font-family: ui-monospace, \"Cascadia Code\", Consolas, monospace; white-space: pre; margin: 0; color: var(--text-2); }\n.pimg { object-fit: contain; flex: none; }\n.product .pimg { filter: drop-shadow(0 3px 6px rgba(74,55,40,.18)); }\n.product .desc { font-size: 12px; color: var(--text-2); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 35px; }\n.btn.wa { background: #2f9e44; border-color: #2f9e44; color: #fff; }\n.btn.wa:hover { background: #2b8a3e; }"),
]

missed = 0
for old, new in R:
    if old in s:
        s = s.replace(old, new)
    else:
        missed += 1
        print('NO ENCONTRADO:', old[:70].replace('\n', '\\n'))

io.open(p, 'w', encoding='utf8').write(s)
print('hecho; reglas aplicadas:', len(R) - missed, '/', len(R))
