import { useLang } from '../i18n/LangContext'

export default function EmergencyBanner() {
  const { t } = useLang()
  return (
    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white py-2 px-4 flex flex-wrap items-center justify-center gap-3 text-sm font-medium text-center">
      <span>🚨 {t('emergency.question')}</span>
      <a href="tel:108" className="bg-white/20 hover:bg-white/30 px-4 py-0.5 rounded-full font-bold transition-colors">📞 {t('emergency.ambulance')}</a>
      <a href="tel:104" className="bg-white/20 hover:bg-white/30 px-4 py-0.5 rounded-full font-bold transition-colors">📞 {t('emergency.helpline')}</a>
      <span className="opacity-80">{t('emergency.warning')}</span>
    </div>
  )
}
