import type { SeedAiTemplate } from './types';

const lines = (...l: string[]): string => l.join('\n');

/**
 * AI templates („Șabloane AI”), one per AI template type: what the digital teacher checks for that kind of item and how
 * it phrases the feedback. The general rules (role, language, tone) live in the AI settings, the facts of each exercise
 * in its context; the output contract (verdicts, keys, delimiters) is fixed in the admin prompt. Seed exercises get the
 * template of their type; production matches templates by title.
 */
export const AI_TEMPLATES: SeedAiTemplate[] = [
  {
    key: 'facts',
    title: 'Prezentare fapte (BAC)',
    criteria: lines(
      '- Fiecare fapt este un fapt istoric real (un eveniment, o acțiune, o măsură), nu o idee generală sau o apreciere.',
      '- Faptul este prezentat, nu doar numit: elevul spune ce s-a întâmplat și adaugă cel puțin un detaliu (când, cine a participat, unde, o consecință). Simpla numire (de exemplu, „dubla alegere”) nu ajunge pentru „ok”.',
      '- Faptul se încadrează în perioada și tema din enunț și din contextul profesorului.',
      '- Faptele sunt diferite între ele: două detalii ale aceluiași fapt sau același fapt scris de două ori contează o singură dată.',
      '- Datele, numele și termenii sunt corecți.',
      'Verdict pentru fiecare fapt: „ok” = fapt corect, din perioada și tema cerute, prezentat cu detalii; „almost” = fapt corect și potrivit, dar doar numit sau cu un detaliu inexact; „no” = fapt greșit, din afara perioadei sau a temei, repetat sau lipsă.',
    ),
    keywords: '',
    responseFormat: lines(
      'Evaluează fiecare fapt separat.',
      'În „good” numește faptul recunoscut și detaliul corect pe care l-a dat elevul.',
      'În „improve” spune exact ce lipsește (de exemplu: „Adaugă și când s-a întâmplat și cine a participat.”) sau ce este greșit (data, perioada, faptul repetat). Nu scrie tu faptul complet în locul elevului.',
    ),
  },
  {
    key: 'comparison',
    title: 'Asemănare / deosebire (BAC)',
    criteria: lines(
      '- Răspunsul numește ambele elemente comparate (de exemplu, ambele acte sau ambele acorduri din enunț).',
      '- Spune explicit ce cere enunțul: pentru o deosebire, prin ce diferă cele două elemente (aceeași trăsătură, diferită la fiecare); pentru o asemănare, ce au în comun amândouă.',
      '- Nu se acceptă: o asemănare când se cere o deosebire (sau invers); descrierea separată a celor două elemente, fără o legătură explicită între ele; o trăsătură adevărată doar pentru unul dintre ele, prezentată ca fiind comună.',
      '- Informațiile despre fiecare element sunt corecte, potrivit contextului profesorului.',
      'Verdict: „ok” = ambele elemente numite, comparația cerută este explicită și corectă; „almost” = comparația este corectă, dar un element nu este numit sau legătura dintre ele este doar sugerată; „no” = comparația este greșită, de alt fel decât cel cerut sau lipsește.',
    ),
    keywords: 'spre deosebire de, în timp ce, pe când, la fel ca, ambele, atât… cât și…, amândouă',
    responseFormat: lines(
      'În „good” spune ce trăsătură a comparat corect elevul.',
      'În „improve” arată ce lipsește: celălalt element, cuvintele care marchează comparația („spre deosebire de…”, „ambele…”) sau o trăsătură corectă. Nu formula tu asemănarea sau deosebirea în locul elevului.',
    ),
  },
  {
    key: 'viewpoint',
    title: 'Punct de vedere (BAC)',
    criteria: lines(
      '- Punctul de vedere (cheia viewpoint) este o apreciere, o părere a elevului despre tema cerută (de exemplu, despre rolul, importanța sau caracterul unui fapt), nu o simplă informație: „Cuza a dat legea rurală” este o informație, nu un punct de vedere.',
      '- Punctul de vedere privește tema și perioada din enunț și din contextul profesorului. O apreciere despre altă temă sau o apreciere vagă, fără legătură clară cu tema, nu se acceptă.',
      '- Informațiile-suport (cheile support-…) au fost deja verificate automat ca fiind din sursă. Judecă doar dacă fiecare susține punctul de vedere formulat de elev: o informație corectă, dar fără legătură cu aprecierea lui, primește „no”.',
      'Verdict pentru viewpoint: „ok” = apreciere clară, pe tema cerută; „almost” = apreciere pe temă, dar vagă sau formulată ca o informație; „no” = informație simplă, altă temă sau lipsă. Pentru fiecare informație-suport: „ok” = o susține, „almost” = o susține doar parțial, „no” = nu o susține.',
    ),
    keywords: 'consider că, în opinia mea, cred că, a avut un rol important, a contribuit la, a fost decisiv',
    responseFormat: lines(
      'Pentru viewpoint spune dacă este o apreciere și dacă privește tema cerută; când este doar o informație, explică diferența (de exemplu: „Spune ce părere ai despre reforme, nu doar ce s-a întâmplat.”).',
      'Pentru fiecare informație-suport spune pe scurt de ce susține sau nu punctul de vedere.',
    ),
  },
  {
    key: 'argument',
    title: 'Argumentare (BAC)',
    criteria: lines(
      '- Argumentul se sprijină pe un fapt istoric relevant pentru afirmația din enunț: faptul trebuie să susțină afirmația, nu doar să fie din aceeași temă.',
      '- Faptul este din perioada cerută și este prezentat (ce s-a întâmplat, când, cine, cu ce rezultat), nu doar numit.',
      '- Legătura dintre fapt și afirmație este explicată prin relația cauză-efect.',
      '- Conectorii de cauzalitate și de concluzie sunt detectați automat (rezultatul apare în mesaj): folosește acel rezultat și nu îl contrazice. Lipsa lor scade calitatea argumentării, dar informația istorică are ponderea cea mai mare.',
      '- Limbajul istoric este adecvat (termeni corecți), iar ideile urmează o ordine logică și cronologică.',
      'Verdict pentru fact: „ok” = fapt relevant, corect, prezentat și legat de afirmație; „almost” = fapt relevant, dar doar numit, legat slab de afirmație sau fără conectori; „no” = fapt greșit, din afara perioadei, care nu susține afirmația sau lipsă.',
    ),
    keywords: 'deoarece, pentru că, întrucât, datorită faptului că, ca urmare, așadar, prin urmare, astfel, în concluzie',
    responseFormat: lines(
      'În „good” numește faptul folosit și ce este corect în legătura lui cu afirmația.',
      'În „improve” dă un pas concret: un detaliu care lipsește (data, participanții, rezultatul), legătura care nu este explicată sau conectorul care lipsește (de exemplu: „Leagă faptul de afirmație printr-un conector cauzal, precum «deoarece».”).',
    ),
  },
  {
    key: 'essay_requirement',
    title: 'Cerință de eseu (BAC)',
    criteria: lines(
      'Evaluezi o singură cerință a eseului. Răspunsul face exact ce cere verbul cerinței:',
      '- „menționați” / „numiți”: elementul cerut este numit corect (eventual cu data); nu sunt necesare detalii;',
      '- „precizați”: elementul cerut (de exemplu, o cauză sau o consecință) este formulat clar și corect;',
      '- „prezentați”: faptul este prezentat cu detalii (ce prevedea sau ce s-a întâmplat, când, cine, o consecință), nu doar numit;',
      '- „formulați un punct de vedere și susțineți-l printr-un argument istoric”: punctul de vedere este o apreciere, nu o simplă informație; argumentul este un fapt istoric relevant, prezentat și legat de punctul de vedere prin relația cauză-efect.',
      'Se respectă numărul de elemente cerut, iar elementele sunt diferite (același fapt scris de două ori contează o singură dată).',
      'Informațiile sunt din perioada și tema cerinței, potrivit contextului profesorului.',
      'La cerința cu argument, conectorii de cauzalitate și de concluzie sunt detectați automat: folosește rezultatul și nu îl contrazice.',
      'La prezentări și la argument contează și limbajul istoric adecvat și succesiunea logică a ideilor.',
      'Verdict: „ok” = cerința este îndeplinită complet și corect; „almost” = cerința este îndeplinită parțial (un element lipsă, prezentare fără detalii, argument fără conectori); „no” = informații greșite, din afara temei sau cerința nu este rezolvată.',
    ),
    keywords: 'deoarece, pentru că, întrucât, ca urmare, așadar, prin urmare, astfel, în concluzie',
    responseFormat: lines(
      'Judecă doar cerința primită, nu tot eseul.',
      'În „improve” spune ce lipsește față de verbul cerinței (de exemplu: „Cerința îți cere să prezinți reforma: adaugă ce prevedea și când a fost adoptată.”) sau ce informație este greșită.',
    ),
  },
];
