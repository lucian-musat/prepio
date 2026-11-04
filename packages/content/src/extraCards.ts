import type { SeedCard } from './types';

/**
 * Cards added after the first production seed, keyed by lesson key. Each lesson appends its entry to its own
 * cards (so a fresh seed includes them), and `addCards.ts` adds them to an already seeded database.
 * Card titles must stay unique within a lesson: `addCards.ts` matches existing cards on type + title.
 */
export const EXTRA_CARDS: Record<string, SeedCard[]> = {
  'unirea-principatelor-cuza': [
    {
      type: 'timeline',
      title: 'Pașii Unirii (1857–1862)',
      points: [
        {
          id: 'point-0',
          date: 'octombrie 1857',
          title: 'Adunările ad-hoc cer unirea',
          details:
            'Rezoluțiile cer unirea Principatelor într-un stat cu numele România, condus de un prinț străin.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-1',
          date: 'august 1858',
          title: 'Convenția de la Paris',
          details:
            'Principatele Unite ale Moldovei și Valahiei: câte un domn, un guvern și o adunare în fiecare principat.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-2',
          date: '5 ianuarie 1859',
          title: 'Cuza, ales domn al Moldovei',
          details: 'Adunarea electivă de la Iași îl alege pe Alexandru Ioan Cuza.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-3',
          date: '24 ianuarie 1859',
          title: 'Cuza, ales domn al Țării Românești',
          details: 'Dubla alegere pune marile puteri în fața faptului împlinit.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-4',
          date: 'decembrie 1861',
          title: 'Imperiul Otoman acceptă unirea deplină',
          details: 'Recunoașterea este valabilă doar pe durata domniei lui Cuza.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-5',
          date: 'ianuarie 1862',
          title: 'Guvern unic și adunare unică',
          details: 'Capitala devine București; statul se numește Principatele Unite Române.',
          key: false,
          imagePath: null,
        },
      ],
    },
    {
      type: 'images',
      title: 'Galerie: oamenii și imaginile Unirii',
      display: 'gallery',
      images: [
        {
          path: 'cuza.jpg',
          alt: 'Portretul lui Alexandru Ioan Cuza',
          credit:
            'Alexandru Ioan Cuza, portret de Carol Popp de Szathmari (1864). Sursa: Wikimedia Commons, domeniu public',
        },
        {
          path: 'kogalniceanu.jpg',
          alt: 'Portretul lui Mihail Kogălniceanu',
          credit: 'Mihail Kogălniceanu, autor necunoscut. Sursa: Wikimedia Commons, domeniu public',
        },
        {
          path: 'hora-unirii-aman.jpg',
          alt: 'Tabloul „Hora Unirii la Craiova” de Theodor Aman',
          credit: 'Theodor Aman, „Hora Unirii la Craiova”. Sursa: Wikimedia Commons, domeniu public',
        },
        {
          path: 'harta-romania-1859-1878.jpg',
          alt: 'Harta Principatelor Unite (România) între 1859 și 1878',
          credit:
            'Teritoriul Principatelor Unite (România) între 1859 și 1878, hartă de Spiridon Manoliu. Sursa: Wikimedia Commons, domeniu public',
        },
      ],
      text:
        'Alexandru Ioan Cuza, domnul Unirii; Mihail Kogălniceanu, autorul propunerii unioniste din Adunarea ' +
        'ad-hoc a Moldovei și al legii rurale; „Hora Unirii”, pictată de Theodor Aman; teritoriul Principatelor ' +
        'Unite între 1859 și 1878.',
    },
    {
      type: 'schema',
      title: 'Unirea Principatelor: cauze și urmări',
      causesLabel: 'Cauze',
      consequencesLabel: 'Urmări',
      causes: [
        {
          id: 'cause-0',
          text: 'Dorința de unitate națională',
          detail: 'Programele revoluției de la 1848 ceruseră deja unirea Moldovei cu Țara Românească.',
        },
        {
          id: 'cause-1',
          text: 'Războiul Crimeii și Tratatul de la Paris (1856)',
          detail: 'Protectoratul rusesc a încetat, iar Principatele au intrat sub garanția colectivă a marilor puteri.',
        },
        {
          id: 'cause-2',
          text: 'Sprijinul Franței lui Napoleon al III-lea',
          detail: 'Franța a susținut unirea și a cerut anularea alegerilor falsificate din Moldova (1857).',
        },
        {
          id: 'cause-3',
          text: 'Lacuna din Convenția de la Paris (1858)',
          detail: 'Convenția nu interzicea alegerea aceleiași persoane ca domn în ambele Principate.',
        },
      ],
      central: {
        id: 'central',
        text: 'Dubla alegere a lui Alexandru Ioan Cuza (1859)',
        detail: 'Ales la Iași la 5 ianuarie și la București la 24 ianuarie 1859.',
      },
      consequences: [
        {
          id: 'consequence-0',
          text: 'Marile puteri acceptă faptul împlinit',
          detail: 'Conferința de la Paris a recunoscut dubla alegere în 1859.',
        },
        {
          id: 'consequence-1',
          text: 'Unirea deplină (1862)',
          detail: 'Guvern unic, adunare unică și capitala la București: statul se numește Principatele Unite Române.',
        },
        {
          id: 'consequence-2',
          text: 'Reformele lui Cuza (1863–1864)',
          detail: 'Secularizarea, legea rurală și legea instrucțiunii publice au modernizat statul.',
        },
      ],
    },
    {
      type: 'video',
      title: 'Istoria cu Virgil: Unirea de la 24 ianuarie 1859',
      youtubeId: 'Ip7Pxren00U',
      startSeconds: null,
      endSeconds: null,
      text: 'Episod din emisiunea „Istoria cu Virgil” (TVR1) despre Unirea Principatelor Române din 1859.',
    },
    {
      type: 'link',
      title: 'Pentru aprofundare',
      url: 'https://ro.wikipedia.org/wiki/Unirea_Principatelor_Rom%C3%A2ne',
      pageTitle: 'Unirea Principatelor Române',
      description:
        'Articolul Wikipedia despre unirea Moldovei și a Țării Românești prin alegerea lui Alexandru Ioan Cuza ' +
        'ca domn al ambelor Principate (5 și 24 ianuarie 1859).',
      image: null,
      text: null,
    },
  ],
  'constitutia-1866': [
    {
      type: 'schema',
      title: 'Constituția din 1866: cauze și urmări',
      causesLabel: 'Cauze',
      consequencesLabel: 'Urmări',
      causes: [
        {
          id: 'cause-0',
          text: 'Abdicarea lui Cuza (februarie 1866)',
          detail: 'Statutul Dezvoltător, legat de regimul personal al lui Cuza, trebuia înlocuit.',
        },
        {
          id: 'cause-1',
          text: 'Aducerea prințului străin Carol I',
          detail: 'Noul domn trebuia să conducă după reguli clare, acceptate de elita politică.',
        },
        {
          id: 'cause-2',
          text: 'Nevoia unei legi fundamentale moderne',
          detail: 'Convenția de la Paris fusese impusă de marile puteri, nu adoptată de români.',
        },
      ],
      central: {
        id: 'central',
        text: 'Constituția din 1866',
        detail: 'Promulgată la 1 iulie 1866, după modelul Constituției Belgiei din 1831.',
      },
      consequences: [
        {
          id: 'consequence-0',
          text: 'Monarhia constituțională ereditară',
          detail: 'Statul se numește oficial România; puterile sunt separate în stat.',
        },
        {
          id: 'consequence-1',
          text: 'Drepturi și libertăți cetățenești garantate',
          detail: 'Votul rămâne însă cenzitar, iar articolul 7 limitează naturalizarea.',
        },
        {
          id: 'consequence-2',
          text: 'Afirmarea autonomiei, pas spre independență',
          detail: 'A fost adoptată fără consultarea Imperiului Otoman și a puterilor garante.',
        },
      ],
    },
    {
      type: 'text',
      title: 'Recapitulare: Constituția din 1866 pe scurt',
      text:
        '### Principiile Constituției\n' +
        '- **suveranitatea națională**: „Toate puterile statului emană de la națiune”;\n' +
        '- **separarea puterilor** în stat: legislativă, executivă și judecătorească;\n' +
        '- **responsabilitatea ministerială**: domnul este inviolabil, miniștrii răspund pentru actele guvernării;\n' +
        '- **garantarea drepturilor și libertăților** cetățenești.\n\n' +
        ':::retine\n' +
        'Constituția din 1866 a fost elaborată după modelul Constituției Belgiei din 1831 și a fost adoptată ' +
        '**fără consultarea Imperiului Otoman și a puterilor garante**. A rămas în vigoare până în 1923.\n' +
        ':::\n\n' +
        ':::atentie\n' +
        'Constituția din 1866 *nu* a introdus votul universal. Votul era **cenzitar**: alegătorii erau împărțiți ' +
        'în colegii după avere și venit, iar cei mai mulți țărani votau indirect, prin delegați.\n' +
        ':::\n\n' +
        ':::exemplu\n' +
        'Cerință de BAC: „Menționează două prevederi ale Constituției din 1866.” Un răspuns corect:\n' +
        '1. Statul se numește oficial România (articolul 1).\n' +
        '2. Forma de guvernământ este monarhia constituțională ereditară.\n' +
        ':::',
    },
    {
      type: 'timeline',
      title: 'Repere: Constituția din 1866 (1866–1923)',
      points: [
        {
          id: 'point-0',
          date: '11 februarie 1866',
          title: 'Abdicarea lui Cuza',
          details: 'Puterea este preluată de o Locotenență domnească.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-1',
          date: 'aprilie 1866',
          title: 'Plebiscitul aprobă alegerea lui Carol',
          details: 'Carol de Hohenzollern-Sigmaringen devine domn al Principatelor Unite.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-2',
          date: '10 mai 1866',
          title: 'Carol depune jurământul la București',
          details: 'Începe domnia lui Carol I (domn 1866–1881, rege 1881–1914).',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-3',
          date: '1 iulie 1866',
          title: 'Promulgarea Constituției',
          details: 'Votată de Adunarea Constituantă, după modelul Constituției Belgiei din 1831.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-4',
          date: '1879',
          title: 'Revizuirea articolului 7',
          details: 'Condiție a Congresului de la Berlin pentru recunoașterea independenței.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-5',
          date: '1884',
          title: 'A doua revizuire',
          details: 'Colegiile pentru Adunarea Deputaților scad de la patru la trei; titlul de rege intră în Constituție.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-6',
          date: '1917',
          title: 'Revizuirea de la Iași',
          details: 'Sunt introduse principiile votului universal și al exproprierii pentru reforma agrară.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-7',
          date: '1923',
          title: 'Constituția din 1923 o înlocuiește',
          details: 'Noua lege fundamentală este adoptată după formarea României Mari.',
          key: false,
          imagePath: null,
        },
      ],
    },
    {
      type: 'video',
      title: 'Constituția din 1866 (lecție video)',
      youtubeId: 'kzjMrYRqdxI',
      startSeconds: null,
      endSeconds: null,
      text:
        'Lecție video susținută de prof. Cristina Gherasim (canalul „Facultatea de Istorie și Filosofie”): ' +
        'Constituția din 1866 și partidele politice din România modernă.',
    },
    {
      type: 'link',
      title: 'Textul Constituției din 1866',
      url: 'https://ro.wikisource.org/wiki/Constitu%C8%9Bia_Rom%C3%A2niei_(1866)',
      pageTitle: 'Constituția României (1866)',
      description: 'Textul integral al Constituției din 1866, în ortografia epocii, pe Wikisource.',
      image: null,
      text: 'Citește articolul 1 (numele statului) și articolul 31 („Toate puterile statului emană de la națiune”).',
    },
  ],
  'independenta-relatii-internationale': [
    {
      type: 'timeline',
      title: 'Drumul spre independență și Regat (1875–1883)',
      points: [
        {
          id: 'point-0',
          date: '1875',
          title: 'Începe criza orientală',
          details: 'Răscoalele antiotomane din Bosnia și Herțegovina.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-1',
          date: '4 aprilie 1877',
          title: 'Convenția româno-rusă',
          details: 'Trupele ruse pot traversa România; Rusia garantează integritatea ei teritorială.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-2',
          date: '9 mai 1877',
          title: 'Proclamarea independenței',
          details: 'Mihail Kogălniceanu: „Suntem independenți; suntem o națiune de sine stătătoare”.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-3',
          date: '30 august 1877',
          title: 'Cucerirea redutei Grivița 1',
          details: 'Armata română luptă alături de cea rusă la Plevna.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-4',
          date: '28 noiembrie 1877',
          title: 'Capitularea Plevnei',
          details: 'Osman Pașa se predă după un lung asediu.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-5',
          date: 'iunie–iulie 1878',
          title: 'Congresul de la Berlin',
          details: 'Independența este recunoscută; România primește Dobrogea și pierde sudul Basarabiei.',
          key: true,
          imagePath: null,
        },
        {
          id: 'point-6',
          date: '14 martie 1881',
          title: 'Proclamarea Regatului României',
          details: 'Carol I este încoronat la 10 mai 1881.',
          key: false,
          imagePath: null,
        },
        {
          id: 'point-7',
          date: 'octombrie 1883',
          title: 'Aderarea la Tripla Alianță',
          details: 'Tratat secret, defensiv, încheiat cu Austro-Ungaria, la care a aderat și Germania.',
          key: false,
          imagePath: null,
        },
      ],
    },
    {
      type: 'schema',
      title: 'Independența: cauze și urmări',
      causesLabel: 'Cauze',
      consequencesLabel: 'Urmări',
      causes: [
        {
          id: 'cause-0',
          text: 'Criza orientală (1875–1877)',
          detail: 'Războiul din Balcani a creat un context favorabil pentru obținerea independenței.',
        },
        {
          id: 'cause-1',
          text: 'Constituția otomană din 1876',
          detail: 'Considera România o „provincie privilegiată” a Imperiului, încălcând autonomia ei.',
        },
        {
          id: 'cause-2',
          text: 'Convenția româno-rusă (aprilie 1877)',
          detail: 'Rusia se obliga să respecte drepturile politice și integritatea teritorială a României.',
        },
      ],
      central: {
        id: 'central',
        text: 'Proclamarea și cucerirea independenței (1877–1878)',
        detail: 'Proclamată la 9 mai 1877 și apărată pe câmpul de luptă la Plevna, Rahova și Smârdan.',
      },
      consequences: [
        {
          id: 'consequence-0',
          text: 'Recunoașterea independenței (Berlin, 1878)',
          detail: 'Cu condiția revizuirii articolului 7 din Constituție.',
        },
        {
          id: 'consequence-1',
          text: 'Dobrogea, Delta Dunării și Insula Șerpilor revin României',
          detail: 'În schimb, sudul Basarabiei (Cahul, Bolgrad, Ismail) a fost cedat Rusiei.',
        },
        {
          id: 'consequence-2',
          text: 'Proclamarea Regatului (1881)',
          detail: 'Crește prestigiul internațional al statului român.',
        },
        {
          id: 'consequence-3',
          text: 'Aderarea la Tripla Alianță (1883)',
          detail: 'Pierderea sudului Basarabiei a arătat pericolul rusesc și izolarea României.',
        },
      ],
    },
    {
      type: 'video',
      title: 'Războiul de Independență (1877–1878), pe scurt',
      youtubeId: 'gJth8m46cwo',
      startSeconds: null,
      endSeconds: null,
      text: 'Documentar video, partea 1 din 2, realizat de canalul „Istorie pe șleau”.',
    },
    {
      type: 'link',
      title: 'Pentru aprofundare',
      url: 'https://ro.wikipedia.org/wiki/R%C4%83zboiul_de_Independen%C8%9B%C4%83_al_Rom%C3%A2niei',
      pageTitle: 'Războiul de Independență al României',
      description:
        'Articolul Wikipedia despre participarea României la Războiul Ruso-Turc din 1877–1878, prin care ' +
        'țara și-a obținut independența față de Imperiul Otoman.',
      image: null,
      text: null,
    },
  ],
};
