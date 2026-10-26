import { REPO } from '../landing/chrome';
import { T } from '../landing/T';
import { Contact, LegalPage, type Bi, type LegalSection } from './LegalPage';
import styles from './legal.module.css';
import { OPERATOR, SERVICE_HOST } from './operator';

const SECURITY = `${REPO}/security`;

const SUMMARY: Bi[] = [
  {
    en: 'Your STL file never leaves your computer. Only what you save is uploaded: the simplified model, the mat, and your labels and pictures.',
    ja: 'STLファイルがあなたのパソコンから送信されることはありません。アップロードされるのは保存したものだけで、軽量化したモデル、マット、ラベルと画像です。',
  },
  {
    en: 'Visitors who scan a mat need no account and get no tracking cookies. We count views, not people.',
    ja: 'マットを読み取る来場者に、アカウントもトラッキング用Cookieも要りません。数えるのは閲覧回数で、人ではありません。',
  },
  {
    en: 'If you sign in, we keep your email address, how you sign in, and the exhibits you save.',
    ja: 'サインインすると、メールアドレス、サインイン方法、保存した展示を保管します。',
  },
  {
    en: 'Published exhibits, and every file you upload, can be opened by anyone who has the link.',
    ja: '公開した展示と、アップロードしたすべてのファイルは、リンクを知っていれば誰でも開けます。',
  },
  {
    en: 'No ads. We don’t sell your data or share it for marketing.',
    ja: '広告はありません。データを販売したり、マーケティングのために共有したりしません。',
  },
];

/** What the site keeps in the browser: name, kind, purpose, lifetime. */
const STORAGE = [
  {
    name: 'sb-…-auth-token…',
    kind: { en: 'Cookies', ja: 'Cookie' },
    what: {
      en: 'Keep you signed in to the Studio, and secure a Google sign-in while it completes. Set only when you sign in.',
      ja: 'スタジオへのサインイン状態を保ち、Googleでのサインイン手続き中はその安全を確保します。サインインするときだけ設定されます。',
    },
    kept: { en: 'Until you sign out, at most 400 days', ja: 'サインアウトするまで（最長400日）' },
  },
  {
    name: 'exhibitar.lang',
    kind: { en: 'Local storage', ja: 'ローカルストレージ' },
    what: {
      en: 'Remembers English or Japanese on these public pages.',
      ja: '公開ページで選んだ言語（英語・日本語）を記憶します。',
    },
    kept: { en: 'Until you clear it', ja: '削除するまで' },
  },
  {
    name: 'exhibitar.viewed.<id>',
    kind: { en: 'Session storage', ja: 'セッションストレージ' },
    what: {
      en: 'Makes sure one browser tab counts one view of an exhibit.',
      ja: '1つのタブで展示の閲覧が1回だけ数えられるようにします。',
    },
    kept: { en: 'Until the tab closes', ja: 'タブを閉じるまで' },
  },
  {
    name: 'exhibitar.imageConvention',
    kind: { en: 'Local storage', ja: 'ローカルストレージ' },
    what: {
      en: 'Remembers how your phone’s AR reports the mat’s markers, so tracking locks on faster next time.',
      ja: 'スマートフォンのARがマットのマーカーをどう報告するかを記憶し、次回の位置合わせを速くします。',
    },
    kept: { en: 'Until you clear it', ja: '削除するまで' },
  },
] as const;

function StorageTable() {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">
            <T en="Name" ja="名前" />
          </th>
          <th scope="col">
            <T en="What it does" ja="用途" />
          </th>
          <th scope="col">
            <T en="Kept" ja="保存期間" />
          </th>
        </tr>
      </thead>
      <tbody>
        {STORAGE.map((row) => (
          <tr key={row.name}>
            <td>
              <code>{row.name}</code>
              <br />
              <T en={row.kind.en} ja={row.kind.ja} />
            </td>
            <td>
              <span className={styles.cellLabel}>
                <T en="What it does" ja="用途" />
              </span>
              <T en={row.what.en} ja={row.what.ja} />
            </td>
            <td>
              <span className={styles.cellLabel}>
                <T en="Kept" ja="保存期間" />
              </span>
              <T en={row.kept.en} ja={row.kept.ja} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: 'who',
    title: { en: 'Who we are', ja: '運営者' },
    body: {
      en: (
        <>
          <p>
            ExhibitAR at {SERVICE_HOST} is run by {OPERATOR} (“we”, “us”). We decide how the data
            described here is used, and we answer for it.
          </p>
          <p>
            ExhibitAR is open source, so anyone can run their own copy. This policy covers only the
            copy at {SERVICE_HOST}. Copies run by others have their own operators and policies.
          </p>
          <p>
            Questions and requests about your data: <Contact />.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            {SERVICE_HOST} で提供するExhibitAR（以下「本サービス」）は、{OPERATOR}
            （以下「当方」）が運営しています。本ポリシーに記載するデータの扱いは当方が決め、その責任を負います。
          </p>
          <p>
            ExhibitARはオープンソースのため、誰でも自分の環境で動かせます。本ポリシーの対象は{' '}
            {SERVICE_HOST}{' '}
            上の本サービスだけです。他の人が運営する環境には、それぞれの運営者とポリシーがあります。
          </p>
          <p>
            データに関するご質問・ご請求：
            <Contact />
          </p>
        </>
      ),
    },
  },
  {
    id: 'never',
    title: { en: 'What never reaches us', ja: '当方に届かない情報' },
    body: {
      en: (
        <ul>
          <li>
            <strong>Your STL file.</strong> It is read, simplified and turned into a mat inside your
            browser. The file itself is never uploaded.
          </li>
          <li>
            <strong>Camera images.</strong> In AR, your phone uses the camera to find the printed
            mat. Our page receives only where the mat is, never the picture, and sends no camera
            images to us.
          </li>
          <li>
            <strong>Your fingerprint or face.</strong> A passkey is checked on your own device. We
            store its public key, never anything about your fingerprint or face.
          </li>
          <li>
            <strong>Your location or contacts.</strong> We don’t ask for them.
          </li>
        </ul>
      ),
      ja: (
        <ul>
          <li>
            <strong>STLファイル。</strong>
            読み込み、軽量化、マットの作成はブラウザの中で行います。ファイルそのものがアップロードされることはありません。
          </li>
          <li>
            <strong>カメラの映像。</strong>
            ARでは、スマートフォンがカメラで印刷したマットを探します。本サービスのページが受け取るのはマットの位置だけで、映像は受け取らず、当方に送信することもありません。
          </li>
          <li>
            <strong>指紋や顔の情報。</strong>
            パスキーの確認はあなたの端末の中で行われます。当方は公開鍵を保管しますが、指紋や顔に関する情報は一切保管しません。
          </li>
          <li>
            <strong>位置情報や連絡先。</strong>求めることはありません。
          </li>
        </ul>
      ),
    },
  },
  {
    id: 'visitors',
    title: { en: 'If you view an exhibit', ja: '展示を見る方の情報' },
    body: {
      en: (
        <>
          <p>Visitors don’t need an account. When you open an exhibit:</p>
          <ul>
            <li>
              Your browser downloads the exhibit: its model, mat images, labels and pictures. These
              normally come from our storage, but an exhibitor can point the model or the marker
              images at another web address; your browser then downloads them from that server,
              which receives the usual technical details below.
            </li>
            <li>
              The exhibit’s view counter goes up by one, once per browser tab. The counter is a
              single number, and nothing about you is stored with it. Its exhibitor can see the
              count. If you are signed in to the Studio in the same browser, the request that counts
              the view carries your sign-in, but it is not stored with the count.
            </li>
            <li>
              Our hosting providers receive the technical details every website receives: your IP
              address, browser and device type, the page requested and the time (section 7).
            </li>
            <li>
              Vercel Web Analytics and Speed Insights record page views and loading times, without
              cookies (section 6).
            </li>
          </ul>
        </>
      ),
      ja: (
        <>
          <p>来場者にアカウントは要りません。展示を開くと、次のことが起こります。</p>
          <ul>
            <li>
              ブラウザが展示（モデル、マットの画像、ラベル、写真）をダウンロードします。通常は当方のストレージから届きますが、展示をつくった人はモデルやマーカー画像の取得先を別のウェブアドレスに指定することもできます。その場合、ブラウザはそのサーバーからダウンロードし、そのサーバーは下記と同じ技術情報を受け取ります。
            </li>
            <li>
              展示の閲覧回数が、ブラウザのタブごとに1回だけ増えます。閲覧回数は単なる数字で、あなたに関する情報は一緒に保存されません。展示をつくった人は、この回数を見られます。同じブラウザでスタジオにサインインしている場合、閲覧を数える通信にはサインイン情報が含まれますが、回数と一緒に保存されることはありません。
            </li>
            <li>
              ホスティング事業者が、あらゆるウェブサイトが受け取るのと同じ技術情報（IPアドレス、ブラウザと端末の種類、表示したページ、日時）を受け取ります（第7条）。
            </li>
            <li>
              Vercel Web Analytics と Speed Insights
              が、Cookieを使わずにページの閲覧と読み込み時間を記録します（第6条）。
            </li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'exhibitors',
    title: { en: 'If you make exhibits', ja: '展示をつくる方の情報' },
    body: {
      en: (
        <>
          <p>
            You can use the Studio without an account. Until you save, your work lives only in your
            browser tab and is gone when you close it. When you create an account we store the
            account details below, and when you save or publish we also store your exhibits.
          </p>
          <h3>Your account</h3>
          <ul>
            <li>Your email address, and your password in hashed form if you set one.</li>
            <li>
              If you continue with Google: the name, email address, profile picture link and account
              ID that Google shares with us.
            </li>
            <li>If you add a passkey: its public key and the name of the device it is on.</li>
            <li>
              Sign-in records our sign-in provider keeps for security, such as when you signed in
              and from which IP address.
            </li>
          </ul>
          <h3>Your exhibits</h3>
          <ul>
            <li>Their titles and descriptions.</li>
            <li>The simplified 3D model (a GLB file) and how it stands on the mat.</li>
            <li>The mat files (PDF, SVG and images) and the marker images.</li>
            <li>Your annotations: titles, text, links, pictures you add, and the tour order.</li>
            <li>
              The calibration you set on your phone, the view count, and when each exhibit was
              created, changed and published.
            </li>
          </ul>
          <h3>Email</h3>
          <p>
            We email you only about your account, for example to confirm your address. No
            newsletters.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            スタジオはアカウントなしでも使えます。保存するまで、作業内容はブラウザのタブの中だけにあり、タブを閉じると消えます。アカウントを作成すると下記のアカウント情報を、保存または公開すると展示の情報も保管します。
          </p>
          <h3>アカウント</h3>
          <ul>
            <li>メールアドレスと、パスワードを設定した場合はそのハッシュ値。</li>
            <li>
              Googleでサインインした場合：Googleから提供される名前、メールアドレス、プロフィール画像のリンク、アカウントID。
            </li>
            <li>パスキーを追加した場合：その公開鍵と、パスキーがある端末の名前。</li>
            <li>
              認証サービスがセキュリティのために残すサインイン記録（サインインの日時やIPアドレスなど）。
            </li>
          </ul>
          <h3>展示</h3>
          <ul>
            <li>タイトルと説明文。</li>
            <li>軽量化した3Dモデル（GLBファイル）と、マット上での置き方。</li>
            <li>マットのファイル（PDF、SVG、画像）とマーカー画像。</li>
            <li>注釈：タイトル、説明、リンク、追加した画像、ツアーの順番。</li>
            <li>スマートフォンで設定した位置合わせ、閲覧回数、展示の作成・更新・公開の日時。</li>
          </ul>
          <h3>メール</h3>
          <p>
            メールを送るのは、アドレスの確認などアカウントに関する用件のときだけです。ニュースレターは送りません。
          </p>
        </>
      ),
    },
  },
  {
    id: 'purposes',
    title: { en: 'Why we use it', ja: '利用目的' },
    body: {
      en: (
        <>
          <p>We use the data above only to:</p>
          <ul>
            <li>run your account and let you sign in;</li>
            <li>store your exhibits, publish them and show them to visitors;</li>
            <li>keep the service secure, find faults and see how fast pages load;</li>
            <li>answer your requests and messages.</li>
          </ul>
          <p>
            We don’t use it for advertising or profiling, and we don’t sell it. We use it for other
            purposes only with your consent or where the law requires it.
          </p>
        </>
      ),
      ja: (
        <>
          <p>上記の情報は、次の目的にだけ利用します。</p>
          <ul>
            <li>アカウントを運用し、サインインできるようにするため</li>
            <li>展示を保存・公開し、来場者に表示するため</li>
            <li>本サービスの安全を守り、不具合を見つけ、ページの表示速度を確認するため</li>
            <li>ご請求やお問い合わせに対応するため</li>
          </ul>
          <p>
            広告やプロファイリングには利用せず、販売もしません。これ以外の目的に利用するのは、ご本人の同意がある場合か、法令に基づく場合だけです。
          </p>
        </>
      ),
    },
  },
  {
    id: 'cookies',
    title: { en: 'Cookies and browser storage', ja: 'Cookieとブラウザ内の保存' },
    body: {
      en: (
        <>
          <p>
            ExhibitAR uses no advertising or cross-site tracking cookies. It keeps only these in
            your browser:
          </p>
          <StorageTable />
          <p>
            Vercel Web Analytics counts page views without cookies: it records the full address of
            each page viewed, the page that linked to it, and the browser, operating system, device
            type and country. To tell visits apart it uses a short-lived value derived from the
            request, which Vercel discards within a day. Speed Insights measures how fast pages load
            and respond to taps and clicks, with the page address, the connection type and which
            part of the page a slow response came from. You can clear this site’s storage at any
            time in your browser’s settings.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            広告用やサイトをまたいだトラッキング用のCookieは使いません。ブラウザに保存するのは次のものだけです。
          </p>
          <StorageTable />
          <p>
            Vercel Web Analytics
            はCookieを使わずにページの閲覧を数え、閲覧したページの完全なアドレス、リンク元のページ、ブラウザ、OS、端末の種類、国を記録します。訪問を区別するためにリクエストから一時的な値をつくりますが、Vercelは1日以内にこれを破棄します。Speed
            Insights
            はページの表示の速さと、タップやクリックへの反応の速さを測り、ページのアドレス、回線の種類、反応が遅れたページ上の部分を記録します。保存された内容は、ブラウザの設定からいつでも削除できます。
          </p>
        </>
      ),
    },
  },
  {
    id: 'providers',
    title: { en: 'Services that process data for us', ja: '業務委託先と外部サービス' },
    body: {
      en: (
        <>
          <p>These companies run parts of ExhibitAR for us, each under its own privacy terms:</p>
          <dl className={styles.providers}>
            <div>
              <dt>Supabase</dt>
              <dd>
                Database, file storage and sign-in. Accounts and exhibits are stored on its servers
                in Tokyo, Japan.
              </dd>
            </div>
            <div>
              <dt>Vercel</dt>
              <dd>
                Hosting, server functions (run in Tokyo) and the analytics in section 6. Its network
                delivers pages from locations around the world.
              </dd>
            </div>
            <div>
              <dt>Google</dt>
              <dd>
                Only if you choose Continue with Google: Google confirms who you are and shares your
                basic profile. On Android, AR in Chrome runs on Google Play Services for AR
                (ARCore), under Google’s privacy policy.
              </dd>
            </div>
            <div>
              <dt>Needle and Apple</dt>
              <dd>
                On iPhone, AR opens in the Needle Go App Clip, made by Needle Tools and delivered by
                Apple. Tapping Start AR sends the exhibit page’s full address to Needle so the App
                Clip can open it. Needle’s and Apple’s privacy policies cover the App Clip itself.
              </dd>
            </div>
          </dl>
          <p>
            Some of these companies are based in the United States and may process data there or in
            other countries. We share data with them only to run the service.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            次の事業者が本サービスの一部を担っています。それぞれの事業者のプライバシーポリシーが適用されます。
          </p>
          <dl className={styles.providers}>
            <div>
              <dt>Supabase</dt>
              <dd>
                データベース、ファイルの保存、認証。アカウントと展示は、東京（日本）にあるサーバーに保存されます。
              </dd>
            </div>
            <div>
              <dt>Vercel</dt>
              <dd>
                ホスティング、サーバー処理（東京で実行）、第6条のアクセス解析。ページは世界各地の拠点から配信されます。
              </dd>
            </div>
            <div>
              <dt>Google</dt>
              <dd>
                「Continue with
                Google」を選んだ場合だけ、Googleが本人確認を行い、基本的なプロフィールを提供します。また、AndroidのChromeでのARは、Googleのプライバシーポリシーのもとで、Google
                Play開発者サービス（AR）（ARCore）を使って動作します。
              </dd>
            </div>
            <div>
              <dt>Needle・Apple</dt>
              <dd>
                iPhoneでは、ARはNeedle Toolsが提供し、Appleが配信するNeedle Go App
                Clipで開きます。「Start AR」をタップすると、App
                Clipが展示を開けるよう、展示ページの完全なアドレスがNeedleに送られます。App
                Clip自体には、NeedleとAppleのプライバシーポリシーが適用されます。
              </dd>
            </div>
          </dl>
          <p>
            これらの事業者には米国の企業が含まれ、米国やその他の国でデータを処理することがあります。データを共有するのは、本サービスの運営に必要な範囲に限ります。
          </p>
        </>
      ),
    },
  },
  {
    id: 'retention',
    title: { en: 'How long we keep it', ja: '保存期間' },
    body: {
      en: (
        <ul>
          <li>
            <strong>Your account:</strong> until you ask us to delete it.
          </li>
          <li>
            <strong>Your exhibits and their files:</strong> until you have them deleted, or your
            account. Unpublishing stops the exhibit page from opening, but the uploaded files stay
            reachable at their direct addresses until they are deleted. If a save fails partway,
            files already uploaded stay stored until they are deleted.
          </li>
          <li>
            <strong>Copies in caches:</strong> uploaded files may be cached by browsers and content
            delivery networks for up to a year, so copies can outlive their deletion for that long.
          </li>
          <li>
            <strong>Studio work you never save:</strong> never sent to us.
          </li>
          <li>
            <strong>Server logs and analytics:</strong> kept by Vercel and Supabase for the short
            periods their services set, then deleted.
          </li>
        </ul>
      ),
      ja: (
        <ul>
          <li>
            <strong>アカウント：</strong>削除のご請求があるまで。
          </li>
          <li>
            <strong>展示とそのファイル：</strong>
            展示またはアカウントを削除するまで。公開を取り消すと展示のページは開けなくなりますが、アップロードしたファイルは削除するまで、直接のアドレスで開ける状態のままです。保存が途中で失敗した場合も、すでにアップロードされたファイルは削除するまで保存されたままです。
          </li>
          <li>
            <strong>キャッシュ上の複製：</strong>
            アップロードしたファイルは、ブラウザやコンテンツ配信ネットワークに最長1年間キャッシュされることがあり、その間は削除後も複製が残る場合があります。
          </li>
          <li>
            <strong>保存しないスタジオの作業：</strong>当方には送信されません。
          </li>
          <li>
            <strong>サーバーのログとアクセス解析：</strong>
            VercelとSupabaseが各サービスで定める短い期間だけ保存し、その後削除されます。
          </li>
        </ul>
      ),
    },
  },
  {
    id: 'rights',
    title: { en: 'Your rights and choices', ja: 'あなたの権利と選択' },
    body: {
      en: (
        <>
          <p>You can ask us to:</p>
          <ul>
            <li>tell you what personal data we hold about you, or send you a copy;</li>
            <li>correct it;</li>
            <li>delete some exhibits, or your whole account and everything in it;</li>
            <li>stop using it, where the law gives you that right.</li>
          </ul>
          <p>
            Email <Contact /> from the address on your account. The Studio has no delete buttons
            yet, so deletion is done on request, and we confirm when it is done.
          </p>
          <p>
            At any time you can also sign out, unpublish an exhibit in the Studio, and clear this
            site’s storage in your browser. If you think we have handled your data wrongly, you can
            also contact the data protection authority where you live.
          </p>
        </>
      ),
      ja: (
        <>
          <p>次のことを当方に請求できます。</p>
          <ul>
            <li>当方が保有するあなたの個人データの開示、またはその写しの提供</li>
            <li>内容の訂正</li>
            <li>一部の展示の削除、またはアカウントとそのすべての内容の削除</li>
            <li>法令で認められる場合の利用の停止</li>
          </ul>
          <p>
            アカウントに登録したメールアドレスから <Contact />{' '}
            までご連絡ください。スタジオにはまだ削除ボタンがないため、削除はご請求に応じて当方が行い、完了したらお知らせします。
          </p>
          <p>
            サインアウト、スタジオでの公開の取り消し、ブラウザに保存された内容の削除は、いつでもご自身でできます。当方のデータの扱いに問題があると考える場合は、お住まいの地域のデータ保護機関（日本では個人情報保護委員会）に相談することもできます。
          </p>
        </>
      ),
    },
  },
  {
    id: 'security',
    title: { en: 'Security', ja: '安全管理' },
    body: {
      en: (
        <>
          <p>
            Connections use HTTPS. Each exhibitor can read and change only their own exhibits, and
            the database itself enforces this. Passwords are stored hashed, never as plain text.
          </p>
          <p>
            <strong>Uploaded files are public by link.</strong> An exhibit’s files, including those
            of drafts, are stored at addresses that contain a random exhibit ID. Anyone who has an
            address can open the file, so don’t upload anything you need to keep secret.
          </p>
          <p>
            Found a security problem? Please report it privately through the{' '}
            <a href={SECURITY}>repository’s Security tab on GitHub</a>.
          </p>
        </>
      ),
      ja: (
        <>
          <p>
            通信はHTTPSで暗号化しています。展示をつくった人は自分の展示だけを閲覧・変更でき、この制限はデータベース自体が強制します。パスワードはハッシュ値で保存し、平文では保存しません。
          </p>
          <p>
            <strong>アップロードしたファイルは、リンクを知っていれば誰でも開けます。</strong>
            展示のファイルは（下書きも含めて）ランダムな展示IDを含むアドレスに保存されます。アドレスを知っている人は誰でも開けるため、秘密にしたいものはアップロードしないでください。
          </p>
          <p>
            セキュリティ上の問題を見つけた場合は、
            <a href={SECURITY}>GitHubリポジトリのSecurityタブ</a>
            から非公開でご報告ください。
          </p>
        </>
      ),
    },
  },
  {
    id: 'children',
    title: { en: 'Children', ja: 'お子さまについて' },
    body: {
      en: (
        <p>
          Studio accounts are not meant for children under 13, and we don’t knowingly create them
          for children. Visitors of any age can view exhibits: viewing needs no account and collects
          nothing beyond what section 3 describes. If you think a child has given us personal data,
          contact us and we will delete it.
        </p>
      ),
      ja: (
        <p>
          スタジオのアカウントは13歳未満のお子さまを対象としておらず、当方がそれと知りながらお子さまのアカウントを作成することはありません。展示の閲覧は年齢を問わずどなたでもでき、アカウントは不要で、第3条に記載した以上の情報は収集しません。お子さまが個人データを提供したと思われる場合はご連絡ください。削除します。
        </p>
      ),
    },
  },
  {
    id: 'changes',
    title: { en: 'Changes to this policy', ja: '本ポリシーの変更' },
    body: {
      en: (
        <p>
          When this policy changes, we update this page and the date at the top. If a change affects
          how we use data you have already given us, we will point it out on the site.
        </p>
      ),
      ja: (
        <p>
          本ポリシーを変更するときは、このページと冒頭の施行日を更新します。すでにご提供いただいたデータの扱いに影響する変更は、本サービス上でお知らせします。
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
          <p>
            {OPERATOR}, operator of ExhibitAR. Please write in English or Japanese. For security
            reports, use GitHub’s private reporting (section 10).
          </p>
        </>
      ),
      ja: (
        <>
          <p className={styles.contactLine}>
            <Contact />
          </p>
          <p>
            ExhibitAR運営者 {OPERATOR}
            。日本語または英語でご連絡ください。セキュリティに関するご報告は、GitHubの非公開報告をご利用ください（第10条）。
          </p>
        </>
      ),
    },
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage
      doc="privacy"
      lede={{
        en: 'ExhibitAR is built to need little about you: your STL file stays on your computer, and visitors need no account. Here is what is collected, why, where it is kept, and how to have it removed.',
        ja: 'ExhibitARは、あなたについての情報をなるべく必要としないようにつくられています。STLファイルは手元に残り、来場者にアカウントは要りません。ここでは、何を集め、なぜ使い、どこに保存し、どう削除できるかを説明します。',
      }}
      summary={SUMMARY}
      sections={SECTIONS}
    />
  );
}
