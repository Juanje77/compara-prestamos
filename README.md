# Finko — Comparador de Préstamos Argentina

Dashboard que compara líneas de préstamos personales, prendarios (autos), hipotecarios UVA y para jubilados/ANSES de los principales bancos argentinos, calcula cuota y costo total por el sistema francés de amortización, y rankea las ofertas por Costo Financiero Total (CFT) para identificar la más conveniente según el monto, plazo y condición laboral del usuario.

Incluye además:

- Comparación lado a lado de hasta 3 ofertas
- Historial de simulaciones con exportación a PDF
- Tabla de amortización mes a mes
- Calculadora de monto máximo accesible según ingreso
- Consulta de situación crediticia (Central de Deudores del BCRA)
- Glosario de términos financieros

Creado para Juan Costantini, Contador Público (MP: T20F94).

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Recharts
- jsPDF

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Datos

Las tasas en `src/data/loans.ts` son de referencia, relevadas de prensa especializada (ver fuentes citadas en cada oferta y en el footer de la app). Una rutina semanal automática revisa novedades y deja un Pull Request para revisión antes de publicar cualquier cambio. Las tasas reales dependen del perfil crediticio y cambian frecuentemente — siempre verificar contra el sitio oficial del banco antes de decidir.
