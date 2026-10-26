import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { EdgeStrips, MatRulers, PaperRuler, SiteFooter, SiteNav } from '../landing/chrome';
import { displayFont, jaFont, textFont } from '../landing/fonts';
import { ArrowRight, ArrowUp } from '../landing/icons';
import landing from '../landing/landing.module.css';
import { LangScript } from '../landing/LangScript';
import { T } from '../landing/T';
import styles from './legal.module.css';
import { CONTACT_EMAIL, EFFECTIVE, OPERATOR, SERVICE_HOST } from './operator';
import { TocTracker } from './TocTracker';

/** One piece of copy in both languages. */
export type Bi = { en: ReactNode; ja: ReactNode };

export type LegalSection = { id: string; title: Bi; body: Bi };

type Doc = 'privacy' | 'terms';

const SHEETS: Record<Doc, { n: number; href: string; title: Bi }> = {
  privacy: {
    n: 1,
    href: '/privacy',
    title: {
      en: 'Privacy policy',
      ja: (
        <>
          プライバシー
          <wbr />
          ポリシー
        </>
      ),
    },
  },
  terms: { n: 2, href: '/terms', title: { en: 'Terms of service', ja: '利用規約' } },
};

/** Block-level copy in both languages; the landing root's `data-lang` shows one. */
export function Both({ en, ja }: Bi) {
  return (
    <>
      <div lang="en" className={landing.en}>
        {en}
      </div>
      <div lang="ja" className={landing.ja}>
        {ja}
      </div>
    </>
  );
}

/** The service's host name, allowed to break only after its dots. */
function Host() {
  return SERVICE_HOST.split('.').map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          .<wbr />
        </>
      )}
      {part}
    </Fragment>
  ));
}

/**
 * The published contact address, as a mail link. Until the address is set, local and
 * preview builds show a marked placeholder and a production build refuses to finish,
 * so the pages never go live without a way to reach the operator.
 */
export function Contact() {
  if (!CONTACT_EMAIL) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('Set CONTACT_EMAIL in src/components/legal/operator.ts before publishing.');
    }
    return <mark className={styles.placeholder}>contact email to be added</mark>;
  }
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

/** A link to the other legal page, named in the active language. */
export function SheetLink({ doc }: { doc: Doc }) {
  const sheet = SHEETS[doc];
  return (
    <Link href={sheet.href}>
      <T en={sheet.title.en} ja={sheet.title.ja} />
    </Link>
  );
}

/**
 * A legal document in the landing page's world: a short mat header with the title
 * and a drawing's title block, then the document printed on the paper sheet, with
 * its contents beside it and a plain-language summary on a plate at the top.
 */
export function LegalPage({
  doc,
  lede,
  summary,
  sections,
}: {
  doc: Doc;
  lede: Bi;
  summary: Bi[];
  sections: LegalSection[];
}) {
  const sheet = SHEETS[doc];
  const other = SHEETS[doc === 'privacy' ? 'terms' : 'privacy'];

  return (
    <div
      data-landing=""
      data-lang="en"
      lang="en"
      suppressHydrationWarning
      className={`${landing.root} ${styles.page} ${displayFont.variable} ${textFont.variable} ${jaFont.variable}`}
    >
      <LangScript />
      <PaperRuler />

      <div className={`${landing.mat} ${styles.mat}`}>
        <MatRulers />
        <div className={`${landing.wrap} ${landing.matWrap}`}>
          <SiteNav />
          <div className={styles.head}>
            <div className={styles.headCopy}>
              <h1 className={styles.h1}>
                <T en={sheet.title.en} ja={sheet.title.ja} />
              </h1>
              <p className={styles.lede}>
                <T en={lede.en} ja={lede.ja} />
              </p>
            </div>
            {/* a drawing's title block, printed on the mat */}
            <dl className={styles.titleBlock}>
              <div>
                <dt>
                  <T en="In effect from" ja="施行日" />
                </dt>
                <dd>
                  <time dateTime={EFFECTIVE.iso}>
                    <T en={EFFECTIVE.en} ja={EFFECTIVE.ja} />
                  </time>
                </dd>
              </div>
              <div>
                <dt>
                  <T en="Operator" ja="運営者" />
                </dt>
                <dd>{OPERATOR}</dd>
              </div>
              <div>
                <dt>
                  <T en="Covers" ja="対象" />
                </dt>
                <dd>
                  <Host />
                </dd>
              </div>
              <div>
                <dt>
                  <T en="Sheet" ja="シート" />
                </dt>
                <dd>
                  {sheet.n} / 2 ·{' '}
                  <Link href={other.href}>
                    <T en={other.title.en} ja={other.title.ja} />
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <EdgeStrips />
      </div>

      <main className={`${landing.wrap} ${styles.doc}`}>
        <div className={styles.layout}>
          <section className={`${landing.plate} ${styles.summary}`} aria-labelledby="summary-title">
            <h2 id="summary-title">
              <T en="The short version" ja="要点" />
            </h2>
            <ul>
              {summary.map((item, i) => (
                <li key={i}>
                  <T en={item.en} ja={item.ja} />
                </li>
              ))}
            </ul>
            <p className={styles.summaryNote}>
              <T
                en="A guide only: the numbered sections below are what count."
                ja="あくまで概要です。正式な内容は、以下の各条項をご確認ください。"
              />
            </p>
          </section>

          <nav id="contents" className={styles.toc} aria-labelledby="contents-title">
            <h2 id="contents-title" className={styles.tocTitle}>
              <T en="Contents" ja="目次" />
            </h2>
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span className={styles.tocNo}>{i + 1}</span>
                    <span>
                      <T en={s.title.en} ja={s.title.ja} />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <TocTracker navId="contents" />

          <div className={styles.sections}>
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={styles.section}
                aria-labelledby={`${s.id}-title`}
              >
                <h2 id={`${s.id}-title`}>
                  <span className={styles.no}>{i + 1}</span>
                  <span>
                    <T en={s.title.en} ja={s.title.ja} />
                  </span>
                </h2>
                {/* narrow screens: the contents are not beside the text, so lead back to them */}
                <a href="#contents" className={styles.toContents}>
                  <T en="Contents" ja="目次" />
                  <ArrowUp />
                </a>
                <div className={styles.prose}>
                  <Both en={s.body.en} ja={s.body.ja} />
                </div>
              </section>
            ))}

            <p className={styles.next}>
              <Link href={other.href} className={landing.textLink}>
                <T
                  en={
                    <>
                      Sheet {other.n} of 2: {other.title.en}
                    </>
                  }
                  ja={
                    <>
                      シート {other.n}/2：{other.title.ja}
                    </>
                  }
                />
                <ArrowRight />
              </Link>
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
