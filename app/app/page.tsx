'use client';

import { useMemo } from 'react';
import { useI18n } from './providers';

export default function Home() {
  const { t } = useI18n();
  const dockerLink = 'http://localhost:3001';
  const dockerBlurbParts = useMemo(() => {
    const message = t('marketing.dockerBlurb', { link: dockerLink });
    const segments = message.split(dockerLink);
    return segments.length === 2 ? segments : [message, ''];
  }, [t, dockerLink]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-blue-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-white/10 px-4 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 shadow">
            {t('marketing.tagline')}
          </span>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('marketing.heroTitle')}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-700 dark:text-gray-300">
            {t('marketing.heroDescription')}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/register"
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors"
            >
              {t('marketing.ctaRegister')}
            </a>
            <a
              href="/login"
              className="px-6 py-3 rounded-xl border border-blue-600 text-blue-700 dark:text-blue-300 font-semibold hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
            >
              {t('marketing.ctaLogin')}
            </a>
            <a
              href="/playground"
              className="px-6 py-3 rounded-xl bg-white/80 text-blue-700 font-semibold shadow hover:bg-white transition-colors dark:bg-white/10 dark:text-blue-200 dark:hover:bg-white/20"
            >
              {t('marketing.ctaPlayground')}
            </a>
          </div>

          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
            {dockerBlurbParts[0]}
            <a
              className="font-semibold underline decoration-dotted underline-offset-4"
              href={`${dockerLink}/`}
            >
              {dockerLink}
            </a>
            {dockerBlurbParts[1]}
          </p>
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-3">
          <div className="rounded-2xl bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('marketing.features.households.title')}</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              {t('marketing.features.households.description')}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>{t('marketing.features.households.point1')}</li>
              <li>{t('marketing.features.households.point2')}</li>
              <li>{t('marketing.features.households.point3')}</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('marketing.features.gallery.title')}</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              {t('marketing.features.gallery.description')}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>{t('marketing.features.gallery.point1')}</li>
              <li>{t('marketing.features.gallery.point2')}</li>
              <li>{t('marketing.features.gallery.point3')}</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('marketing.features.export.title')}</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              {t('marketing.features.export.description')}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>{t('marketing.features.export.point1')}</li>
              <li>{t('marketing.features.export.point2')}</li>
              <li>{t('marketing.features.export.point3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
