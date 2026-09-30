export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    fontFamily: { sans: ['"Noto Sans Thai"', '"Sarabun"', 'system-ui', 'sans-serif'] },
    colors: { navy: { 50:'#f1f5fb',100:'#dde6f3',200:'#b9cbe6',300:'#8aa8d2',400:'#5a82b9',500:'#3a639e',600:'#2b4c80',700:'#223d68',800:'#182c4f',900:'#0f1e38' } }
  } },
  plugins: [],
}
