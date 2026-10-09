const v = (n) => `rgb(var(--${n}) / <alpha-value>)`
const status = (n) => ({ bg: v(n + '-bg'), fg: v(n + '-fg'), line: v(n + '-line') })

/** All colors come from CSS variables (src/index.css) so light/dark themes switch the whole UI. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // app pages fit the screen on computers (owner, Oct 2026) — see components/pager.tsx
      screens: { fit: { raw: '(min-width: 1024px) and (min-height: 600px)' } },
      // named sizes from DESIGN.md (QA, Oct 2026) — new code uses these instead of picking its own values
      borderRadius: { control: '0.75rem', card: '1rem', panel: '1.5rem' },
      minHeight: { control: '40px', touch: '44px' },
      fontFamily: { sans: ['"Noto Sans Thai"', '"Sarabun"', '"Microsoft YaHei"', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'] },
      colors: {
        page: v('page'), surface: v('surface'), surface2: v('surface2'), surface3: v('surface3'), line: v('line'), control: v('control-line'),
        ink: v('ink'), muted: v('muted'), primary: v('primary'), onprimary: v('onprimary'), brand: v('brand'), brandfg: v('brandfg'),
        header: v('header'), onheader: v('onheader'), hero: v('hero'), onhero: v('onhero'), herotile: v('herotile'), heroline: v('heroline'), accent: v('accent'), onaccent: v('onaccent'),
        ok: status('ok'), warn: status('warn'), danger: status('danger'), review: status('review'), info: status('info'),
      },
    },
  },
  plugins: [],
}
