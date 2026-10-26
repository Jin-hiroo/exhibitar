import { REPO } from '../landing/chrome';
import { Contact, LegalPage, SheetLink, type Bi, type LegalSection } from './LegalPage';
import styles from './legal.module.css';
import { OPERATOR, SERVICE_HOST } from './operator';

const LICENSE = `${REPO}/blob/main/LICENSE`;

const SUMMARY: Bi[] = [
  {
    en: 'ExhibitAR is free, still in development, and provided as it is.',
    ja: 'ExhibitARは無料で、開発中のため、現状のままで提供します。',
  },
  {
    en: 'Your models, text and pictures stay yours. You let us store them and show them to the people you share them with.',
    ja: 'モデル、文章、画像の権利はあなたに残ります。当方には、それらを保存し、あなたが共有した相手に表示することを許可していただきます。',
  },
  {
    en: 'Published exhibits are public, so upload only what you have the right to share.',
    ja: '公開した展示は誰でも見られます。共有する権利があるものだけをアップロードしてください。',
  },
  {
    en: 'Look up from the screen in AR, and set exhibits up so visitors can move around them safely.',
    ja: 'ARでは画面から目を離して周囲に気を配り、来場者が安全に動ける場所に展示を置いてください。',
  },
  {
    en: 'The laws of Japan apply.',
    ja: '日本法が適用されます。',
  },
];

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: { en: 'Agreeing to these terms', ja: '本規約への同意' },
    body: {
      en: (
        <>
          <p>
            These terms are an agreement between you and {OPERATOR} (“we”, “us”), who runs ExhibitAR
            at {SERVICE_HOST} (“the service”). By using the service, whether you make exhibits in
            the Studio or view them, you agree to these terms. If you don’t agree, please don’t use
            it.
          </p>
          <p>
            The <SheetLink doc="privacy" /> explains how we handle personal data and is part of
            these terms. If you use ExhibitAR on behalf of an organisation, you confirm that you may
            accept these terms for it.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            本規約は、{SERVICE_HOST} でExhibitAR（以下「本サービス」）を運営する{OPERATOR}
            （以下「当方」）と、利用者であるあなたとの間の取り決めです。スタジオで展示をつくる場合も、展示を見る場合も、本サービスを利用することで本規約に同意したものとみなします。同意できない場合は、本サービスを利用しないでください。
          </p>
          <p>
            個人データの扱いを定める
            <SheetLink doc="privacy" />
            は、本規約の一部です。団体のために本サービスを利用する場合、あなたはその団体を代表して本規約に同意する権限があることを確認するものとします。
          </p>
        </>
      ),
    },
  },
  {
    id: 'service',
    title: { en: 'The service', ja: '本サービスについて' },
    body: {
      en: (
        <>
          <p>
            ExhibitAR turns a 3D-printed object into an AR exhibit: you prepare a model and a
            printable placement mat in the Studio, and visitors see your labels on the real object
            through a phone.
          </p>
          <p>
            The service is free and still under development. Features can change, and some may not
            work on every device. Today, AR runs in Chrome on Android with a feature flag turned on;
            on iPhone it opens through the Needle Go App Clip, which has not yet been tested on a
            device; other browsers show a 3D view.
          </p>
          <p>
            How closely labels line up with the real object depends on things outside our control,
            such as printing the mat at 100 %, the lighting and the phone.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            ExhibitARは、3Dプリントした物体をAR展示にするサービスです。スタジオでモデルと印刷用の配置マットを用意すると、来場者はスマートフォン越しに、実物の上に表示されるラベルを見られます。
          </p>
          <p>
            本サービスは無料で、現在も開発中です。機能は変わることがあり、すべての端末で動作するとは限りません。現時点では、ARはAndroidのChromeで実験的機能（フラグ）を有効にすると動作します。iPhoneではNeedle
            Go App
            Clip経由で開きますが、実機ではまだ検証していません。その他のブラウザでは3D表示になります。
          </p>
          <p>
            ラベルが実物にどれだけ正確に重なるかは、マットを100%で印刷したか、照明、スマートフォンなど、当方が管理できない条件に左右されます。
          </p>
        </>
      ),
    },
  },
  {
    id: 'accounts',
    title: { en: 'Accounts', ja: 'アカウント' },
    body: {
      en: (
        <>
          <p>
            You need an account to save and publish exhibits. Use an email address that works, keep
            your sign-in details to yourself, and tell us if you think someone else has used your
            account. You are responsible for what is done with it.
          </p>
          <p>
            You must be at least 13 to create an account. If you are under the age of majority where
            you live, a parent or guardian must agree to these terms for you.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            展示を保存・公開するにはアカウントが必要です。受信できるメールアドレスを使い、サインイン情報を他人に教えず、第三者に使われたと思われる場合は当方にお知らせください。アカウントで行われたことには、あなたが責任を負います。
          </p>
          <p>
            アカウントを作成できるのは13歳以上の方です。お住まいの地域で未成年の場合は、親権者などの法定代理人の同意を得たうえでご利用ください。
          </p>
        </>
      ),
    },
  },
  {
    id: 'content',
    title: { en: 'Your content', ja: 'あなたのコンテンツ' },
    body: {
      en: (
        <>
          <p>
            Your content is what you upload or write: models, mat files, pictures, titles, text and
            links. You keep all your rights to it.
          </p>
          <p>
            So that we can run the service, you give us a worldwide, non-exclusive, royalty-free
            licence to store, copy, process (for example, simplify and convert models), display and
            deliver your content, only as needed to run ExhibitAR. The licence ends when your
            content is deleted, apart from copies that browsers and content delivery networks may
            keep in their caches for up to a year, and short-lived logs.
          </p>
          <p>
            Published exhibits can be viewed by anyone with the link or the QR code, and the files
            you upload, including those of drafts, can be opened by anyone who has their address.
          </p>
          <p>
            You confirm that you have the rights needed to upload your content and let visitors view
            it, and that it does not break the law or anyone else’s rights.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            コンテンツとは、あなたがアップロードしたり書いたりしたもの（モデル、マットのファイル、画像、タイトル、文章、リンク）をいいます。その権利はすべてあなたに残ります。
          </p>
          <p>
            本サービスを運営するため、あなたは当方に対し、本サービスの運営に必要な範囲で、コンテンツを保存、複製、処理（モデルの軽量化や変換など）、表示、配信するための、全世界的、非独占的かつ無償の利用許諾を与えるものとします。この許諾は、コンテンツが削除された時点で終了します。ただし、ブラウザやコンテンツ配信ネットワークのキャッシュに最長1年間残る複製と、短期間で消えるログは除きます。
          </p>
          <p>
            公開した展示はリンクやQRコードを知っていれば誰でも見られ、アップロードしたファイル（下書きのものを含む）は、アドレスを知っていれば誰でも開けます。
          </p>
          <p>
            あなたは、コンテンツをアップロードし来場者に見せるために必要な権利を持っていること、そしてそれが法令や他人の権利を侵害しないことを保証するものとします。
          </p>
        </>
      ),
    },
  },
  {
    id: 'use',
    title: { en: 'What not to do', ja: '禁止事項' },
    body: {
      en: (
        <>
          <p>Don’t use ExhibitAR to:</p>
          <ul>
            <li>upload content that is illegal, or that infringes copyright or other rights;</li>
            <li>
              publish content that is hateful, harassing, sexually explicit or harmful to children;
            </li>
            <li>share other people’s personal data without their permission;</li>
            <li>pretend to be someone else, or mislead visitors in ways that could harm them;</li>
            <li>
              upload malware, or try to get around security, access limits or other people’s
              accounts;
            </li>
            <li>
              put an unreasonable load on the service, for example with automated mass requests;
            </li>
            <li>store files that have nothing to do with an exhibit.</li>
          </ul>
        </>
      ),
      ja: (
        <>
          <p>本サービスを、次の目的や方法で利用しないでください。</p>
          <ul>
            <li>違法なコンテンツや、著作権などの権利を侵害するコンテンツのアップロード</li>
            <li>差別的、嫌がらせ、性的に露骨、または子どもに有害なコンテンツの公開</li>
            <li>他人の個人データを、本人の許可なく共有すること</li>
            <li>他人になりすますこと、または来場者に害が及びうる形で誤解させること</li>
            <li>
              マルウェアのアップロード、セキュリティやアクセス制限、他人のアカウントを回避・侵害しようとすること
            </li>
            <li>自動化された大量のリクエストなどにより、本サービスに過大な負荷をかけること</li>
            <li>展示と関係のないファイルの保存</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'safety',
    title: { en: 'Exhibits in the real world', ja: '実物の展示と安全' },
    body: {
      en: (
        <>
          <p>
            You are responsible for your exhibit in the physical world: where the object and its mat
            stand, that they are stable, and any signs or supervision your visitors need.
          </p>
          <p>
            In AR, the screen can draw attention away from your surroundings. Visitors: watch for
            people, steps and obstacles, don’t use AR while walking near traffic, and keep an eye on
            children who use it.
          </p>
          <p>
            AR labels are extra information. Don’t rely on them where a mistake could cause harm.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            実物の展示はあなたの責任で設置してください。物体とマットを置く場所、それらが安定していること、来場者に必要な案内や見守りについても同様です。
          </p>
          <p>
            ARを使っている間は、画面に注意を奪われがちです。来場者の方は、周囲の人や段差、障害物に気を配り、車や自転車の近くを歩きながら使わないでください。お子さまが使うときは大人が見守ってください。
          </p>
          <p>
            ARのラベルは補足的な情報です。誤りが害につながるおそれのある場面では、ラベルに頼らないでください。
          </p>
        </>
      ),
    },
  },
  {
    id: 'removal',
    title: { en: 'Removing content and accounts', ja: 'コンテンツとアカウントの削除' },
    body: {
      en: (
        <>
          <p>
            We may remove content, or suspend or close an account, if it breaks these terms or the
            law, or puts the service or other people at risk. Where it is reasonable, we will tell
            you why.
          </p>
          <p>
            You can stop using ExhibitAR at any time and ask us to delete your account, as the{' '}
            <SheetLink doc="privacy" /> describes. To report content that breaks these terms, email{' '}
            <Contact />.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            コンテンツやアカウントが本規約や法令に違反する場合、または本サービスや他人を危険にさらす場合、当方はコンテンツの削除、アカウントの一時停止または閉鎖を行うことがあります。合理的な場合には、その理由をお知らせします。
          </p>
          <p>
            あなたはいつでも本サービスの利用をやめ、
            <SheetLink doc="privacy" />
            に従ってアカウントの削除を請求できます。本規約に違反するコンテンツを見つけた場合は、
            <Contact /> までご報告ください。
          </p>
        </>
      ),
    },
  },
  {
    id: 'open-source',
    title: { en: 'Open source', ja: 'オープンソース' },
    body: {
      en: (
        <p>
          The ExhibitAR source code is licensed under the <a href={LICENSE}>Apache License 2.0</a>.
          That licence governs the code; these terms govern the hosted service at {SERVICE_HOST}. If
          you run your own copy, you operate it yourself and under your own terms.
        </p>
      ),
      ja: (
        <p>
          ExhibitARのソースコードは <a href={LICENSE}>Apache License 2.0</a>{' '}
          で公開しています。コードにはこのライセンスが、{SERVICE_HOST}{' '}
          上の本サービスには本規約が適用されます。自分の環境でExhibitARを動かす場合は、あなた自身が運営者となり、ご自身の規約のもとで運営してください。
        </p>
      ),
    },
  },
  {
    id: 'third-parties',
    title: { en: 'Other companies’ services', ja: '外部サービス' },
    body: {
      en: (
        <p>
          Parts of ExhibitAR rely on services from other companies, such as Google sign-in, Google
          Play Services for AR on Android and the Needle Go App Clip on iPhone. Their own terms
          apply when you use them, and we are not responsible for those services.
        </p>
      ),
      ja: (
        <p>
          本サービスの一部は、Googleサインイン、AndroidのGoogle
          Play開発者サービス（AR）、iPhoneのNeedle Go App
          Clipなど、他社のサービスを利用しています。それらを利用する際はそれぞれの規約が適用され、当方はそれらのサービスについて責任を負いません。
        </p>
      ),
    },
  },
  {
    id: 'warranty',
    title: { en: 'No warranty', ja: '保証の否認' },
    body: {
      en: (
        <p>
          ExhibitAR is provided “as is” and “as available”. We don’t promise that it will be
          uninterrupted, free of errors, accurate or fit for a particular purpose, or that your
          content will be kept forever. Keep your own copies of anything important, including your
          STL files.
        </p>
      ),
      ja: (
        <p>
          本サービスは「現状のまま」「提供可能な範囲で」提供します。当方は、本サービスが中断しないこと、誤りがないこと、正確であること、特定の目的に適すること、コンテンツが永久に保存されることを保証しません。STLファイルを含め、大切なものはご自身で保管してください。
        </p>
      ),
    },
  },
  {
    id: 'liability',
    title: { en: 'Limits on our liability', ja: '責任の制限' },
    body: {
      en: (
        <>
          <p>
            We are not liable for indirect, incidental or consequential damage, or for lost data,
            profits or opportunities, that arise from your use of ExhibitAR.
          </p>
          <p>
            This does not limit our liability for damage caused by our intentional misconduct or
            gross negligence, or any liability that the law does not allow to be limited, including
            under the Consumer Contract Act of Japan.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            本サービスの利用によって生じた間接的、付随的または派生的な損害、およびデータ、利益または機会の損失について、当方は責任を負いません。
          </p>
          <p>
            ただし、当方の故意または重大な過失による損害、および消費者契約法その他の法令により制限できない責任については、この限りではありません。
          </p>
        </>
      ),
    },
  },
  {
    id: 'changes',
    title: { en: 'Changes', ja: '変更' },
    body: {
      en: (
        <>
          <p>
            We may change the service, or stop it. If we plan to shut it down, we will give notice
            on the site in advance where we can, so you can keep copies of what you need.
          </p>
          <p>
            We may update these terms. The date at the top shows the current version, and we will
            point out significant changes on the site. If you keep using ExhibitAR after a change,
            you accept the updated terms.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            当方は、本サービスの内容を変更し、または提供を終了することがあります。終了する場合は、必要なものを保存できるよう、可能な限り事前に本サービス上でお知らせします。
          </p>
          <p>
            当方は本規約を変更することがあります。現在の版は冒頭の施行日で示し、重要な変更は本サービス上でお知らせします。変更後も本サービスを利用した場合、変更後の規約に同意したものとみなします。
          </p>
        </>
      ),
    },
  },
  {
    id: 'law',
    title: { en: 'Governing law and courts', ja: '準拠法・管轄裁判所' },
    body: {
      en: (
        <p>
          These terms are governed by the laws of Japan. The Tokyo District Court has exclusive
          jurisdiction as the court of first instance over any dispute about these terms or the
          service.
        </p>
      ),
      ja: (
        <p>
          本規約は日本法に準拠します。本規約または本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      ),
    },
  },
  {
    id: 'contact',
    title: { en: 'Contact', ja: 'お問い合わせ' },
    body: {
      en: (
        <>
          <p className={styles.contactLine}>
            <Contact />
          </p>
          <p>{OPERATOR}, operator of ExhibitAR. Please write in English or Japanese.</p>
        </>
      ),
      ja: (
        <>
          <p className={styles.contactLine}>
            <Contact />
          </p>
          <p>ExhibitAR運営者 {OPERATOR}。日本語または英語でご連絡ください。</p>
        </>
      ),
    },
  },
];

export function TermsOfService() {
  return (
    <LegalPage
      doc="terms"
      lede={{
        en: `The rules for using ExhibitAR at ${SERVICE_HOST}. The code is open source under Apache 2.0; these terms cover the hosted service.`,
        ja: `${SERVICE_HOST} でExhibitARを利用するためのルールです。コードはApache 2.0のオープンソースで、本規約はホスティングされたサービスに適用されます。`,
      }}
      summary={SUMMARY}
      sections={SECTIONS}
    />
  );
}
