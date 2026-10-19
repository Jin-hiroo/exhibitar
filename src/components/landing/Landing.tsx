import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { siteUrl } from '@/lib/db/env';
import { viewerUrl } from '@/lib/mat/qr';
import { FullscreenMat } from './FullscreenMat';
import { displayFont, jaFont, textFont } from './fonts';
import { ArrowDown, ArrowRight, ArrowUpRight } from './icons';
import arAngle from './img/ar-skull-angle.jpg';
import skullPhoto from './img/ar-skull-front.jpg';
import exCaffeineJa from './img/example-caffeine-ja.jpg';
import exCaffeine from './img/example-caffeine.jpg';
import exGearsJa from './img/example-gears-ja.jpg';
import exGears from './img/example-gears.jpg';
import exJarJa from './img/example-jar-ja.jpg';
import exJar from './img/example-jar.jpg';
import exMassingJa from './img/example-massing-ja.jpg';
import exMassing from './img/example-massing.jpg';
import matSheet from './img/mat-a3.png';
import annotateShot from './img/studio-annotate.jpg';
import dropShot from './img/studio-drop.jpg';
import setupShot from './img/studio-setup.jpg';
import phoneShot from './img/viewer-phone.png';
import styles from './landing.module.css';
import { LangScript } from './LangScript';
import { LangSwitch } from './LangSwitch';
import { MeasuredWidth } from './MeasuredWidth';
import { RulerCursor } from './RulerCursor';
import { T } from './T';

const REPO = 'https://github.com/Jin-hiroo/exhibitar';
/** Bundled demo exhibit (public/fixtures), served without a database. */
const DEMO_ID = 'mockcube01';

const TOP_NUMBERS = Array.from({ length: 80 }, (_, i) => i);
/** One text node, one number per centimetre line, long enough for the tallest layout. */
const LEFT_NUMBERS = Array.from({ length: 420 }, (_, i) => i).join('\n');

const FEATURES = [
  {
    en: [
      'Any printed shape',
      'Tracking reads only the paper mat, so there is nothing to scan or train.',
    ],
    ja: ['どんな形でも', '位置合わせに使うのは紙のマットだけ。物体のスキャンや学習は不要です。'],
  },
  {
    en: [
      'Your STL stays with you',
      'Parsing, simplifying and mat-making run in your browser. Only the simplified model is uploaded.',
    ],
    ja: [
      'STLは手元に',
      '読み込み、軽量化、マット作成はブラウザ内で行います。アップロードされるのは軽量化したモデルだけです。',
    ],
  },
  {
    en: [
      'A mat in one click',
      'PDF or SVG with the outline, a FRONT arrow, a 100 mm check bar and the QR code. Bigger objects tile across sheets.',
    ],
    ja: [
      'マットはワンクリック',
      '輪郭、FRONT矢印、100 mmの確認用目盛り、QRコード入りのPDFまたはSVG。大きな物は複数枚に分けて印刷できます。',
    ],
  },
  {
    en: [
      'Points and painted regions',
      'Each with a title, text, an optional image and link, and its place in the guided tour.',
    ],
    ja: [
      'ポイントと塗り領域',
      'それぞれにタイトル、説明、画像やリンク（任意）、ガイドツアーの順番を設定できます。',
    ],
  },
  {
    en: [
      'Labels that behave',
      'The printed object hides the labels behind it, and labels fade when seen from behind.',
    ],
    ja: ['自然なラベル', '実物の裏側にあるラベルは隠れ、背面から見ると薄くなります。'],
  },
  {
    en: [
      'No app for visitors',
      'Android Chrome runs it with WebXR. iPhone opens it through an App Clip (not yet tested on a device). Other browsers show a 3D view.',
    ],
    ja: [
      '来場者はアプリ不要',
      'AndroidのChromeはWebXRで表示します。iPhoneはApp Clip経由（実機では未検証）。その他のブラウザでは3D表示になります。',
    ],
  },
  {
    en: ['Calibrate once', 'Nudge the model into place on a phone. It is saved for every visitor.'],
    ja: [
      '位置合わせは一度だけ',
      'スマートフォンでモデルの位置を微調整すると、すべての来場者に反映されます。',
    ],
  },
  {
    en: [
      'Start without an account',
      'The Studio works as a draft in your browser tab. Sign in to publish.',
    ],
    ja: [
      'アカウントなしで始められる',
      'スタジオはブラウザのタブ内で下書きとして使えます。公開にはサインインが必要です。',
    ],
  },
] as const;

/** The example plates: up to 440px, two across from 768px (see .uses). */
const USE_SIZES = '(min-width: 768px) 440px, 92vw';

/** One example per audience in the statement: a model made for the page, labelled in the Studio. */
const USES = [
  {
    en: [
      'Museums and galleries',
      'Set a replica beside the original and point out the maker’s stamp and an ancient repair on the object itself.',
    ],
    ja: [
      '博物館・ギャラリー',
      '原品の隣にレプリカを置き、工房の刻印や古い補修跡を、モノの上で直接示せます。',
    ],
    img: [exJar, exJarJa],
    alt: [
      'A printed storage jar on its mat, labelled 1 Handle, 2 Maker’s stamp and 3 Ancient repair',
      'マットの上の、印刷した壺。1 取っ手、2 工房の刻印、3 古い補修跡のラベル付き',
    ],
  },
  {
    en: [
      'Classrooms and science centres',
      'Pass round a caffeine molecule with its oxygen, nitrogen and methyl groups named where they sit.',
    ],
    ja: [
      '教室・科学館',
      '手から手へ回せるカフェイン分子。酸素、窒素、メチル基の名前が、その位置に出ます。',
    ],
    img: [exCaffeine, exCaffeineJa],
    alt: [
      'A printed caffeine molecule on a base plate, labelled 1 Oxygen, 2 Nitrogen and 3 Methyl group',
      '台座付きの、印刷したカフェイン分子。1 酸素、2 窒素、3 メチル基のラベル付き',
    ],
  },
  {
    en: [
      'Design and architecture studios',
      'Leave a massing model on the client’s table that names the office tower, the roof terrace and the plaza.',
    ],
    ja: [
      'デザイン・建築事務所',
      'クライアントの机に置いた模型が、オフィス棟、屋上テラス、広場を自分で説明します。',
    ],
    img: [exMassing, exMassingJa],
    alt: [
      'A printed massing model of a tower, a lower wing and trees on a site plate, labelled 1 Office tower, 2 Roof terrace and 3 Public plaza',
      '敷地の上にタワー、低層棟、木が並ぶ、印刷した建築模型。1 オフィス棟、2 屋上テラス、3 広場のラベル付き',
    ],
  },
  {
    en: [
      'Anyone with a 3D printer',
      'Bring a gear train to a maker fair that shows visitors where to turn it and what each gear does.',
    ],
    ja: [
      '3Dプリンターを持つすべての人',
      'メイカーイベントに持っていくギア模型に、どこを回すのか、それぞれのギアの役目を表示します。',
    ],
    img: [exGears, exGearsJa],
    alt: [
      'A printed gear train with a crank, labelled 1 Turn here, 2 Idler gear and 3 Output gear',
      'クランク付きの、印刷したギア模型。1 ここを回す、2 アイドラー、3 出力ギアのラベル付き',
    ],
  },
] as const;

function tilt(deg: number): CSSProperties {
  return { '--r': `${deg}deg` } as CSSProperties;
}

async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#141414', light: '#0000' },
  });
}

/**
 * The public landing page. The hero is the green cutting mat, with rulers; the
 * rest of the page is a sheet of paper lying on it, with the Studio screens
 * printed on it. The left ruler counts down both.
 */
export async function Landing() {
  const demoUrl = viewerUrl(siteUrl(), DEMO_ID);
  const qr = await qrSvg(demoUrl);

  return (
    <div
      data-landing=""
      data-lang="en"
      lang="en"
      suppressHydrationWarning
      className={`${styles.root} ${displayFont.variable} ${textFont.variable} ${jaFont.variable}`}
    >
      <LangScript />

      {/* printed on the paper; the mat covers its top with its own ruler, numbered the same */}
      <div className={`${styles.rulerLeft} ${styles.rulerPaper}`} aria-hidden>
        <span className={styles.rulerLeftNumbers}>{LEFT_NUMBERS}</span>
      </div>
      <span className={styles.cmProbe} data-cm-probe="" aria-hidden />
      <RulerCursor />

      <div className={styles.mat}>
        <div className={styles.rulerTop} aria-hidden>
          {TOP_NUMBERS.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className={styles.rulerLeft} aria-hidden>
          <span className={styles.rulerLeftNumbers}>{LEFT_NUMBERS}</span>
        </div>
        <div className={styles.rulerCorner} aria-hidden>
          cm
        </div>

        <div className={`${styles.wrap} ${styles.matWrap}`}>
          <header className={styles.nav}>
            <Link href="/" className={styles.wordmark}>
              ExhibitAR
            </Link>
            <nav className={styles.navLinks} aria-label="Main">
              <a href="#how">
                <T en="How it works" ja="使い方" />
              </a>
              <a href="#demo">
                <T en="Demo" ja="デモ" />
              </a>
              <a href={REPO}>GitHub</a>
            </nav>
            <LangSwitch />
            <Link href="/studio" className={styles.navStudio}>
              <T en="Open Studio" ja="スタジオを開く" />
            </Link>
          </header>

          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroCopy}>
              <h1 id="hero-title" className={styles.h1}>
                <T
                  en="Turn any 3D print into an AR exhibit"
                  ja={
                    <>
                      どんな
                      <wbr />
                      3Dプリントも、
                      <wbr />
                      AR展示に。
                    </>
                  }
                />
              </h1>
              <p className={styles.lede}>
                <T
                  en="Upload the STL, mark what matters and print one placement mat. Visitors scan its QR code and see your labels on the real object, with no app to install."
                  ja="STLをアップロードして見どころに印をつけ、配置マットを1枚印刷するだけ。来場者がQRコードを読み取ると、実物の上にラベルが表示されます。アプリのインストールは不要です。"
                />
              </p>
              <div className={styles.actions}>
                <Link href="/studio/new" className={styles.tape}>
                  <span className={styles.tapeFace}>
                    <T en="Make an exhibit" ja="展示をつくる" />
                    <ArrowRight />
                  </span>
                </Link>
                <a href="#demo" className={styles.textLink}>
                  <T en="Try the demo" ja="デモを試す" />
                  <ArrowDown />
                </a>
              </div>
              <p className={styles.fine}>
                <T
                  en={
                    <>
                      Free and open source under Apache 2.0. <a href={REPO}>Source on GitHub</a>
                    </>
                  }
                  ja={
                    <>
                      無料・オープンソース（Apache 2.0）。<a href={REPO}>GitHubでソースを見る</a>
                    </>
                  }
                />
              </p>
            </div>

            <figure className={styles.heroFigure}>
              <div className={styles.print} style={tilt(-2.5)} data-measure="">
                <Image
                  src={skullPhoto}
                  alt="AR view through a phone: a 3D-printed skull on its printed mat, with labels 1 左目 (left eye) and 2 歯 (teeth) pinned to it"
                  priority
                  placeholder="blur"
                  sizes="(min-width: 1024px) 470px, 92vw"
                />
                <span className={styles.strip} data-pos="tl" aria-hidden />
                <span className={styles.strip} data-pos="tr" aria-hidden />
              </div>
              <figcaption className={styles.dimCaption}>
                <span className={styles.dimLabel}>
                  <MeasuredWidth />
                </span>
                <T
                  en="Seen through a phone: the skull on its A3 mat. The labels stay on the real object as the camera moves."
                  ja="スマートフォン越しに見た、A3マットの上の頭蓋骨。カメラを動かしても、ラベルは実物の上にとどまります。"
                />
              </figcaption>
            </figure>
          </section>
        </div>

        {/* the paper's top edge is taped to the mat */}
        <span className={styles.edgeStrip} data-pos="l" aria-hidden />
        <span className={styles.edgeStrip} data-pos="r" aria-hidden />
      </div>

      <main className={`${styles.wrap} ${styles.paper}`}>
        <section id="how" className={styles.section} aria-labelledby="how-title">
          <h2 id="how-title" className={styles.h2}>
            <T
              en="From STL to exhibit"
              ja={
                <>
                  STLから
                  <wbr />
                  展示まで
                </>
              }
            />
          </h2>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <div className={styles.stepText}>
                <span className={styles.stepNo} aria-hidden>
                  1
                </span>
                <h3>
                  <T en="Upload your STL" ja="STLをアップロード" />
                </h3>
                <p>
                  <T
                    en="Drop the file into the Studio. It opens right in your browser, and the file itself never leaves your computer. Check its size, choose the face it stands on, and point the FRONT arrow at your visitors."
                    ja="STLファイルをスタジオにドロップします。ファイルはブラウザの中で開かれ、パソコンの外には送信されません。サイズを確認し、接地する面を選んで、FRONT矢印を来場者の方へ向けます。"
                  />
                </p>
                <div className={`${styles.plate} ${styles.plateDrop}`}>
                  <Image
                    src={dropShot}
                    alt="The Studio's drop area: “Drop an STL file here. Binary or ASCII. It is processed in your browser and never uploaded.” and a Choose file button"
                    sizes="(min-width: 1024px) 472px, 92vw"
                  />
                </div>
              </div>
              <figure className={styles.stepVisual}>
                <div className={styles.plate}>
                  <Image
                    src={setupShot}
                    alt="The Studio's Setup tab after dropping in “skull on stand.stl”: the skull, lower jaw included, standing on its base with the FRONT arrow, and beside it the size (166 × 183 × 228 mm), a mesh note, the resting faces and the FRONT setting"
                    sizes="(min-width: 1024px) 620px, 92vw"
                  />
                </div>
                <figcaption className={styles.legend}>
                  <T
                    en="A moment after the drop, the model stands on its base, with its size, the faces it can rest on and the FRONT setting beside it."
                    ja="ドロップするとすぐ、モデルが台座で立った状態で表示され、横にサイズ、置き方の候補、FRONTの向きが並びます。"
                  />
                </figcaption>
              </figure>
            </li>

            <li className={styles.step}>
              <div className={styles.stepText}>
                <span className={styles.stepNo} aria-hidden>
                  2
                </span>
                <h3>
                  <T
                    en="Mark what matters"
                    ja={
                      <>
                        見どころに
                        <wbr />
                        印をつける
                      </>
                    }
                  />
                </h3>
                <p>
                  <T
                    en="Drop points or paint regions on the model. Give each a title and text, an optional image or link, and a place in the guided tour."
                    ja="モデルにポイントを置いたり、領域を塗ったりします。それぞれにタイトルと説明、必要なら画像やリンク、ガイドツアーの順番を設定できます。"
                  />
                </p>
              </div>
              <div className={styles.stepVisual}>
                <div className={styles.plate}>
                  <Image
                    src={annotateShot}
                    alt="The Studio's Annotate tab: points 1 左目 and 2 歯 on the skull model, with the first point's title, text and label distance"
                    sizes="(min-width: 1024px) 620px, 92vw"
                  />
                </div>
              </div>
            </li>

            <li className={styles.step}>
              <div className={styles.stepText}>
                <span className={styles.stepNo} aria-hidden>
                  3
                </span>
                <h3>
                  <T en="Print the mat" ja="マットを印刷" />
                </h3>
                <p>
                  <T
                    en="One sheet, A4 to A3 or Letter to Tabloid, with the outline, a FRONT arrow, four markers and the QR code. Print at 100 %, check the 100 mm bar, and stand the print on its outline."
                    ja="輪郭、FRONT矢印、4つのマーカー、QRコードが入った1枚（A4〜A3、レター〜タブロイド）。100%で印刷して100 mmの目盛りを確認し、輪郭の上にプリントを置きます。"
                  />
                </p>
              </div>
              <div className={styles.stepVisual}>
                <div className={`${styles.plate} ${styles.plateMat}`}>
                  <Image
                    src={matSheet}
                    alt="The skull's A3 placement mat: four square markers, the stand's outline, a QR code, a 100 mm bar and a FRONT arrow"
                    sizes="400px"
                  />
                </div>
              </div>
            </li>

            <li className={styles.step}>
              <div className={styles.stepText}>
                <span className={styles.stepNo} aria-hidden>
                  4
                </span>
                <h3>
                  <T
                    en="Visitors see it in AR"
                    ja={
                      <>
                        来場者が
                        <wbr />
                        ARで見る
                      </>
                    }
                  />
                </h3>
                <p>
                  <T
                    en="They scan the QR code on the mat, tap Start AR and point the phone at the mat, with no app to install. Your labels sit on the real object, hide behind it and fade when seen from behind. You calibrate once on your own phone, for everyone."
                    ja="マットのQRコードを読み取り、「Start AR」をタップしてマットにスマートフォンを向けるだけ。アプリのインストールは不要です。ラベルは実物の上に表示され、裏側では隠れ、背面からは薄くなります。位置合わせはあなたのスマートフォンで一度だけ。全員に反映されます。"
                  />
                </p>
              </div>
              <div className={styles.stepVisual}>
                <div className={`${styles.plate} ${styles.plateAr}`}>
                  <Image
                    src={arAngle}
                    alt="AR on a phone, seen from the side: the 3D-printed skull standing on its mat on a desk, with labels 1 左目 and 2 歯 on the left eye and the teeth"
                    sizes="(min-width: 1024px) 440px, 92vw"
                  />
                </div>
              </div>
            </li>

            <li className={styles.step}>
              <div className={styles.stepText}>
                <span className={styles.stepNo} aria-hidden>
                  5
                </span>
                <h3>
                  <T
                    en="Or view it in 3D"
                    ja={
                      <>
                        3Dでも
                        <wbr />
                        見られる
                      </>
                    }
                  />
                </h3>
                <p>
                  <T
                    en="View in 3D shows the model standing on its printed mat, right in the phone's browser. Anyone can turn it and tap your labels, even on a phone without AR or far from the exhibit."
                    ja="「View in 3D」を選ぶと、印刷したマットの上に立つモデルがスマートフォンのブラウザに表示されます。AR非対応のスマートフォンでも、展示から離れた場所でも、モデルを回してラベルをタップできます。"
                  />
                </p>
              </div>
              <div className={styles.stepVisual}>
                <div className={`${styles.plate} ${styles.platePhone}`}>
                  <Image
                    src={phoneShot}
                    alt="The skull exhibit on a phone without AR: View in 3D, the model on its printed mat with the 左目 label selected"
                    sizes="270px"
                  />
                </div>
              </div>
            </li>
          </ol>
        </section>

        <section id="demo" className={styles.section} aria-labelledby="demo-title">
          <div className={styles.demo}>
            <div className={styles.demoCopy}>
              <h2 id="demo-title" className={styles.h2}>
                <T en="Try it on this screen" ja="この画面で試す" />
              </h2>
              <p className={styles.sectionLede}>
                <T
                  en="This is a real placement mat, made for a 60 mm test cube. Your screen stands in for the paper."
                  ja="これは60 mmのテスト用キューブのための、本物の配置マットです。紙のかわりに画面を使います。"
                />
              </p>
              <ol className={styles.demoSteps}>
                <li>
                  <T
                    en="Scan the QR code with your phone."
                    ja="スマートフォンでQRコードを読み取ります。"
                  />
                </li>
                <li>
                  <T
                    en="Tap Start AR and point the camera at the mat on this screen."
                    ja="「Start AR」をタップし、この画面のマットにカメラを向けます。"
                  />
                </li>
                <li>
                  <T
                    en="The cube appears on its outline with two labels. Tap one."
                    ja="輪郭の上にキューブが現れ、ラベルが2つ表示されます。タップしてみてください。"
                  />
                </li>
              </ol>
              <div className={styles.qrCard}>
                <div
                  className={styles.qr}
                  role="img"
                  aria-label={`QR code: ${demoUrl}`}
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <p>
                  <T
                    en="Scan to open the demo"
                    ja={
                      <>
                        読み取って
                        <wbr />
                        デモを開く
                      </>
                    }
                  />
                </p>
              </div>
              <p className={styles.phoneHint}>
                <T
                  en={
                    <>
                      On a phone already? Open this page on a computer and scan the mat from there,
                      or <Link href={`/v/${DEMO_ID}`}>open the demo in 3D here</Link>.
                    </>
                  }
                  ja={
                    <>
                      スマートフォンで見ている場合は、パソコンでこのページを開いてマットを読み取るか、
                      <Link href={`/v/${DEMO_ID}`}>ここで3D表示のデモを開いてください</Link>。
                    </>
                  }
                />
              </p>
              <p className={styles.note}>
                <T
                  en={
                    <>
                      AR runs in Chrome on Android with{' '}
                      <code>chrome://flags/#webxr-incubations</code> turned on. iPhone and other
                      browsers show the 3D view. A screen is only a stand-in: on a mat printed at
                      100 %, the labels sit on a real object.
                    </>
                  }
                  ja={
                    <>
                      ARはAndroidのChromeで <code>chrome://flags/#webxr-incubations</code>{' '}
                      を有効にすると動きます。iPhoneやその他のブラウザでは3D表示になります。画面はあくまで代用です。100%で印刷したマットなら、ラベルは実物の上に重なります。
                    </>
                  }
                />
              </p>
              <p className={styles.demoLinks}>
                <a href="/fixtures/mock-cube-mat.pdf">
                  <T en="Print it instead (PDF, A4)" ja="印刷して試す（PDF・A4）" />
                </a>
                <Link href={`/v/${DEMO_ID}`}>
                  <T en="Open the demo on this device" ja="この端末でデモを開く" />
                </Link>
              </p>
            </div>
            <FullscreenMat>
              <Image
                src="/fixtures/mock-cube-mat.svg"
                alt="Placement mat for the demo cube: four square markers, the cube's outline, a FRONT arrow, a 100 mm bar and a QR code"
                width={1123}
                height={794}
                unoptimized
              />
            </FullscreenMat>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="spec-title">
          <div className={styles.spec}>
            <h2 id="spec-title" className={styles.h2}>
              <T en="What it does" ja="できること" />
            </h2>
            <dl className={styles.specList}>
              {FEATURES.map((f) => (
                <div key={f.en[0]}>
                  <dt>
                    <T en={f.en[0]} ja={f.ja[0]} />
                  </dt>
                  <dd>
                    <T en={f.en[1]} ja={f.ja[1]} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={styles.statement} aria-labelledby="for-title">
          <div className={styles.statementHead}>
            <svg className={styles.angleGuide} viewBox="0 0 400 400" aria-hidden focusable={false}>
              <path d="M400 400 0 0M400 400 169 0" />
              <text x="232" y="214">
                45°
              </text>
              <text x="302" y="204">
                60°
              </text>
            </svg>
            <h2 id="for-title">
              <T
                en="Made for museums and galleries, classrooms and science centres, design and architecture studios, and anyone with a 3D printer."
                ja={
                  <>
                    博物館や
                    <wbr />
                    ギャラリー、
                    <wbr />
                    教室や
                    <wbr />
                    科学館、
                    <wbr />
                    デザイン・
                    <wbr />
                    建築事務所、
                    <wbr />
                    そして
                    <wbr />
                    3Dプリンターを
                    <wbr />
                    持つ
                    <wbr />
                    すべての
                    <wbr />
                    人へ。
                  </>
                }
              />
            </h2>
          </div>
          <ul className={styles.uses}>
            {USES.map((u) => (
              <li key={u.en[0]} className={styles.use}>
                <div className={`${styles.plate} ${styles.plateUse}`}>
                  <T
                    en={<Image src={u.img[0]} alt={u.alt[0]} sizes={USE_SIZES} />}
                    ja={<Image src={u.img[1]} alt={u.alt[1]} sizes={USE_SIZES} />}
                  />
                </div>
                <h3>
                  <T en={u.en[0]} ja={u.ja[0]} />
                </h3>
                <p>
                  <T en={u.en[1]} ja={u.ja[1]} />
                </p>
              </li>
            ))}
          </ul>
          <p className={styles.legend}>
            <T
              en="Example models made for this page. Each was labelled in the Studio and is shown in its Preview, the same 3D view as step 5."
              ja="このページのために作った例のモデルです。それぞれスタジオでラベルを付け、プレビューで表示しました。ステップ5と同じ3D表示です。"
            />
          </p>
        </section>

        <section className={styles.close} aria-labelledby="close-title">
          <h2 id="close-title" className={styles.h2}>
            <T
              en="Free and open source"
              ja={
                <>
                  無料・
                  <wbr />
                  オープンソース
                </>
              }
            />
          </h2>
          <p>
            <T
              en="ExhibitAR is licensed under Apache 2.0. Read the code, run your own copy, or help build it."
              ja="ExhibitARはApache 2.0ライセンスで公開しています。コードを読むのも、自分の環境で動かすのも、開発に参加するのも自由です。"
            />
          </p>
          <div className={styles.actions}>
            <Link href="/studio/new" className={styles.tape}>
              <span className={styles.tapeFace}>
                <T en="Make an exhibit" ja="展示をつくる" />
                <ArrowRight />
              </span>
            </Link>
            <a href={REPO} className={styles.textLink}>
              <T en="Source on GitHub" ja="GitHubでソースを見る" />
              <ArrowUpRight />
            </a>
          </div>
        </section>
      </main>

      <footer className={`${styles.wrap} ${styles.footer}`}>
        <p className={styles.imprint}>
          ExhibitAR ·{' '}
          <T en="Placement mats for any 3D print" ja="あらゆる3Dプリントのための配置マット" />
        </p>
        <nav aria-label="Footer" className={styles.footerLinks}>
          <Link href="/studio">Studio</Link>
          <Link href={`/v/${DEMO_ID}`}>
            <T en="Demo" ja="デモ" />
          </Link>
          <a href={REPO}>GitHub</a>
          <a href={`${REPO}/blob/main/LICENSE`}>Apache 2.0</a>
        </nav>
      </footer>
    </div>
  );
}
