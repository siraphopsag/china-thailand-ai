/* Runs before first paint (served from same origin, CSP-safe): restore saved theme/language, else system preference. */
(function () {
  try {
    var theme = localStorage.getItem('cnth-theme')
    if (theme !== 'light' && theme !== 'dark') theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    var accent = localStorage.getItem('cnth-accent')
    if (accent === 'forest' || accent === 'ocean' || accent === 'plum' || accent === 'ember') document.documentElement.setAttribute('data-accent', accent)
    var lang = localStorage.getItem('cnth-lang')
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'th'
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light') }
})()
