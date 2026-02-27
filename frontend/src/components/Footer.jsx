import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'
import { useLang } from '../i18n/LangContext'

export default function Footer() {
  const { pathname } = useLocation()
  const { t } = useLang()

  if (pathname === '/chat') return (
    <footer className="bg-gray-800 text-gray-400 text-center py-3 text-xs">
      ⚠️ {t('footer.notDevice')}
    </footer>
  )

  const emergencyLinks = t('footer.emergencyLinks')

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 pb-6">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-5 py-3 text-orange-300 text-sm mb-10">
          ⚠️ {t('footer.disclaimer')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Logo size={36} />
              <span className="text-white font-bold text-lg">ArogyaSaarthi AI</span>
            </div>
            <p className="text-sm leading-relaxed">{t('footer.desc')}</p>
            <p className="text-xs mt-3 italic text-gray-500">{t('footer.tagline')}</p>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{t('footer.navigate')}</h4>
            <ul className="space-y-2 text-sm list-none p-0 m-0">
              {[['/', t('nav.home')], ['/chat', t('nav.chat')], ['/symptoms', t('nav.symptoms')], ['/nearby', t('nearby.navLabel')], ['/appointment', t('nav.appointment')]].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-gray-400 hover:text-green-400 no-underline transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{t('footer.emergency')}</h4>
            <ul className="space-y-2 text-sm list-none p-0 m-0">
              {Array.isArray(emergencyLinks) && emergencyLinks.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-gray-400 hover:text-green-400 no-underline transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 flex flex-wrap justify-between items-center gap-3 text-xs">
          <span>{t('footer.copyright')}</span>
          <span className="text-gray-600">{t('footer.legal')}</span>
        </div>
      </div>
    </footer>
  )
}
