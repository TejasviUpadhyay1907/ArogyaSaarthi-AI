import { Link } from 'react-router-dom'
import { useLang } from '../i18n/LangContext'

export default function Home() {
  const { t } = useLang()

  const features = t('home.features')
  const steps = t('home.steps')

  const featureIcons = ['🎙️', '🛡️', '🏥', '📵', '🔒', '📊']
  const featureColors = ['bg-green-50', 'bg-blue-50', 'bg-orange-50', 'bg-green-50', 'bg-blue-50', 'bg-orange-50']

  return (
    <>
      {/* HERO */}
      <section className="min-h-[calc(100vh-112px)] bg-gradient-to-br from-green-50 via-blue-50 to-orange-50 flex items-center px-4 sm:px-6 py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-green-200/20 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-blue-200/20 blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 border border-green-200 rounded-full px-4 py-1.5 text-xs font-bold mb-6 uppercase tracking-wide">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse-dot" />
              {t('home.badge')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-gray-900 mb-5">
              {t('home.h1a')}<br />
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">{t('home.h1b')}</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-lg">
              {t('home.subtitle')}
            </p>
            <div className="flex flex-wrap gap-4 mb-10">
              <Link to="/chat" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold text-base shadow-lg shadow-green-200 hover:-translate-y-1 hover:shadow-xl transition-all no-underline">
                🎙️ {t('home.ctaPrimary')}
              </Link>
              <Link to="/symptoms" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-blue-600 font-semibold text-base border-2 border-blue-600 hover:bg-blue-600 hover:text-white hover:-translate-y-1 transition-all no-underline">
                🩺 {t('home.ctaSecondary')}
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 sm:gap-8">
              {[['100%', t('home.stat1')], ['5', t('home.stat2')], ['20+', t('home.stat3')], ['0', t('home.stat4')]].map(([n, l]) => (
                <div key={l} className="text-center min-w-0">
                  <div className="text-xl sm:text-2xl font-extrabold text-green-600">{n}</div>
                  <div className="text-xs text-gray-400 font-medium mt-0.5 break-words">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — demo card (all text from i18n) */}
          <div className="flex justify-center lg:justify-end animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="animate-float bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xl">🤖</div>
                <div>
                  <div className="font-bold text-sm text-gray-800">ArogyaSaarthi AI</div>
                  <div className="text-xs text-green-500 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-dot" />
                    {t('home.demoOnline')}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm p-3.5 text-sm text-gray-600 mb-3">
                {t('home.demoAIMsg')}
              </div>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl rounded-tr-sm p-3.5 text-sm text-gray-700 text-right mb-4">
                {t('home.demoUserMsg')}
              </div>
              <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 text-center">
                <span className="inline-block bg-red-500 text-white text-xs font-bold px-4 py-1 rounded-full mb-2">🚨 {t('home.demoUrgency')}</span>
                <div className="text-sm font-bold text-red-700">{t('home.demoCall')}</div>
                <div className="text-xs text-gray-500 mt-1">{t('home.demoFacility')}</div>
              </div>
              <div className="text-center text-xs text-gray-400 mt-3">⚠️ {t('chat.disclaimer')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-green-100 text-green-700 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide mb-3">{t('home.featuresLabel')}</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
              {t('home.featuresTitle')} <span className="text-green-600">{t('home.featuresTitleSpan')}</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('home.featuresSub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(features) && features.map((f, i) => (
              <div key={i} className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm hover:-translate-y-2 hover:shadow-xl hover:border-green-200 transition-all cursor-default">
                <div className={`w-14 h-14 ${featureColors[i]} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{featureIcons[i]}</div>
                <h3 className="font-bold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide mb-3">{t('home.howLabel')}</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
              {t('home.howTitle')} <span className="text-green-600">{t('home.howTitleSpan')}</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('home.howSub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.isArray(steps) && steps.map((s, i) => (
              <div key={i} className="text-center px-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-blue-600 text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
                  {i + 1}
                </div>
                <h3 className="font-bold text-gray-800 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-r from-green-800 to-blue-800 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-5">🩺</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t('home.ctaTitle')}</h2>
          <p className="text-lg opacity-80 mb-8">{t('home.ctaSub')}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/chat" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-green-700 font-bold hover:-translate-y-1 hover:shadow-xl transition-all no-underline">
              🎙️ {t('home.ctaBtn1')}
            </Link>
            <Link to="/symptoms" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border-2 border-white text-white font-semibold hover:bg-white hover:text-blue-700 hover:-translate-y-1 transition-all no-underline">
              🩺 {t('home.ctaBtn2')}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
