# IT-Veljekset Group — Design-järjestelmä

**Lähde: ProjectHub 0.6.1 · Elokuu 2026**

Tämä dokumentti kuvaa ProjectHubissa käytetyn design-järjestelmän niin, että sen voi ottaa käyttöön uudessa sovelluksessa kopioimalla kaksi tiedostoa ja noudattamalla sääntöjä. Kaikki koodiesimerkit ovat suoraan toimivasta sovelluksesta.

---

## 1. Periaatteet

Viisi sääntöä, joista kaikki muu seuraa.

**1. Hillitty työkalu, ei esittelysivu.** Sovellusta katsotaan kuusi tuntia päivässä. Mikään ei saa huutaa. Ei gradientteja, ei varjoja koristeena, ei animaatioita jotka eivät kerro mitään.

**2. Väri on tieto, ei koriste.** Väri varataan merkitykselle: myöhässä on punainen, käynnissä sininen, valmis vihreä. Projektin oma väri on tunniste (piste, palkki) — ei taustatäyttö. Jos poistat kaikki värit ja käyttöliittymä on yhä ymmärrettävä, väritys on oikein.

**3. Yksi taso, yksi reuna.** Pinnat erottuvat 1px reunalla, eivät varjolla. Laatikko laatikossa laatikossa on merkki siitä, että rakenne on väärä.

**4. Skaalat ovat rajallisia.** Kolme radiusta, viisi fonttikokoa, yksi varjo. Jos uusi arvo tuntuu tarpeelliselta, kysy ensin miksi olemassa oleva ei kelpaa.

**5. Piilotettu toiminto ei ole olemassa.** Tämä opittiin kantapään kautta: ProjectHubin ajastinnappi näkyi vain hover-tilassa, eikä käyttäjä löytänyt ajanseurantaa lainkaan. **Ensisijainen toiminto ei koskaan piiloudu hoverin taakse.** Hover saa paljastaa toissijaisia (siirrä, poista), ei koskaan pääasiaa.

---

## 2. Tokenit

Värit ovat CSS-muuttujissa `R G B` -kolmikkoina. Se on ainoa syy siihen, että Tailwindin läpinäkyvyysmodifioijat (`bg-surface/60`) toimivat omilla väreillä.

### 2.1 `src/renderer/src/index.css` — kopioi sellaisenaan

```css
:root {
  /* Pinnat, tummasta vaaleaan */
  --c-bg: 13 15 18;          /* sovelluksen tausta */
  --c-surface: 20 23 28;     /* paneeli, kortti, sivupalkki */
  --c-surface-2: 26 30 36;   /* kentät, hover, korotettu pinta */
  --c-line: 36 41 47;        /* reuna */
  --c-line-strong: 51 58 67; /* reuna hoverissa, vierityspalkki */

  /* Teksti, kolme tasoa */
  --c-text: 230 232 235;     /* leipäteksti ja otsikot */
  --c-muted: 154 163 173;    /* toissijainen */
  --c-subtle: 107 116 126;   /* metatieto, placeholder */

  /* Aksentti ja tilat */
  --c-accent: 59 130 246;
  --c-accent-fg: 255 255 255;
  --c-success: 34 197 94;
  --c-warn: 245 158 11;
  --c-danger: 239 68 68;

  /* Mitat */
  --titlebar-height: 40px;
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 56px;
  --page-gutter: 24px;

  color-scheme: dark;
}

:root[data-theme='light'] {
  --c-bg: 246 247 249;
  --c-surface: 255 255 255;
  --c-surface-2: 241 243 245;
  --c-line: 227 230 234;
  --c-line-strong: 205 211 218;
  --c-text: 20 23 26;
  --c-muted: 92 101 111;
  --c-subtle: 133 142 152;
  --c-accent: 37 99 235;
  --c-accent-fg: 255 255 255;
  --c-success: 22 163 74;
  --c-warn: 217 119 6;
  --c-danger: 220 38 38;

  color-scheme: light;
}
```

**Vaalea teema ei ole tumman käänteisluku.** Vaaleassa aksentti tummenee (`#2563EB`) jotta kontrasti valkoista vasten riittää, ja pinnat menevät valkoisesta harmaaseen päinvastaisessa järjestyksessä kuin tummassa.

`color-scheme` on tärkeä: se saa natiivit elementit (vierityspalkit, `<select>`, päivämäärävalitsimet) noudattamaan teemaa ilman omaa tyylittelyä.

### 2.2 Skaalat

| Skaala | Arvot | Käyttö |
|--------|-------|--------|
| **Radius** | 6px (`sm`) · 10px (`md`) · 14px (`lg`) | sm: tagit ja pikkumerkit · md: napit, kentät, kortit · lg: paneelit, modaalit |
| **Fontti** | 11 `meta` · 12 `label` · 13 `ui` · 15 `title` · 20 `page` | ui on oletus. Mitään muuta ei käytetä. |
| **Paino** | 400 · 500 · 600 | 600 vain otsikoille ja luvuille |
| **Väli** | Tailwindin 4px-asteikko | Ei `[13px]`-tyylisiä arvoja |
| **Varjo** | yksi: `0 12px 32px rgb(0 0 0 / 0.28)` | Vain kelluvalle: modaali, valikko, raahattava kortti |

Rivikorkeudet on sidottu fonttikokoon: 11/16, 12/16, 13/18, 15/22, 20/28.

### 2.3 `tailwind.config.js`

```js
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        'line-strong': token('line-strong'),
        text: token('text'),
        muted: token('muted'),
        subtle: token('subtle'),
        accent: token('accent'),
        'accent-fg': token('accent-fg'),
        success: token('success'),
        warn: token('warn'),
        danger: token('danger')
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px' },
      fontSize: {
        meta: ['11px', '16px'],
        label: ['12px', '16px'],
        ui: ['13px', '18px'],
        title: ['15px', '22px'],
        page: ['20px', '28px']
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', '-apple-system', 'sans-serif']
      },
      boxShadow: { float: '0 12px 32px rgb(0 0 0 / 0.28)' }
    }
  }
}
```

**Sääntö:** komponenttikoodissa ei saa esiintyä `slate`, `gray`, `zinc` tai muita Tailwindin vakiovärejä eikä `#rrggbb`-arvoja. Jos väri ei löydy tokeneista, tokenit ovat vajaat — lisää token, älä kovakoodaa.

---

## 3. Komponenttisanasto

Nämä luokat määritellään kerran `@layer components` -lohkossa ja niitä käytetään kaikkialla. Ne ovat tarkoituksella harvat: kymmenen luokkaa kattaa koko sovelluksen.

```css
@layer components {
  /* Pinnat */
  .panel { @apply bg-surface border border-line rounded-lg; }
  .card  { @apply bg-surface border border-line rounded-md; }
  .card-interactive { @apply card transition-colors hover:border-line-strong hover:bg-surface-2; }

  /* Napit — .btn on pohja, muut modifioivat sitä */
  .btn {
    @apply inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md text-ui font-medium
           border border-line bg-surface-2 text-text transition-colors
           hover:border-line-strong hover:bg-line
           disabled:opacity-40 disabled:pointer-events-none;
  }
  .btn-primary { @apply bg-accent text-accent-fg border-transparent hover:brightness-110; }
  .btn-ghost   { @apply bg-transparent border-transparent text-muted hover:text-text hover:bg-surface-2 hover:border-line; }
  .btn-danger  { @apply text-danger border-danger/30 bg-danger/10 hover:bg-danger/20; }
  .btn-icon    { @apply w-8 p-0 flex-shrink-0; }
  .btn-sm      { @apply h-7 px-2 text-label; }

  /* Kentät */
  .field {
    @apply w-full h-8 px-2.5 rounded-md text-ui bg-surface-2 border border-line text-text
           placeholder:text-subtle transition-colors
           hover:border-line-strong focus:border-accent focus:outline-none disabled:opacity-40;
  }
  textarea.field { @apply h-auto py-2 leading-relaxed resize-y; }
  .field-label   { @apply block text-label font-medium text-muted mb-1.5; }

  /* Chipit */
  .chip { @apply inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-label font-medium
                 border border-line bg-surface-2 text-muted transition-colors
                 hover:text-text hover:border-line-strong; }
  .chip-active { @apply bg-accent/10 border-accent/40 text-accent; }

  /* Kelluvat */
  .menu { @apply bg-surface border border-line-strong rounded-lg shadow-float py-1; }
  .menu-item { @apply flex w-full items-center gap-2.5 px-3 h-8 text-ui text-muted text-left
                      hover:bg-surface-2 hover:text-text; }

  /* Sivurunko */
  .page { @apply flex flex-col h-full min-w-0; }
  .page-head { @apply flex-shrink-0 flex items-start justify-between gap-4 border-b border-line;
               padding: 16px var(--page-gutter); }
  .page-body { @apply flex-1 overflow-y-auto; }
  .page-body-inner { padding: var(--page-gutter); padding-bottom: 40px; }
  .section-label { @apply text-label font-semibold text-subtle; }
}
```

**Korkeudet ovat vakiot:** nappi ja kenttä 32px (`h-8`), pieni nappi ja chip 28px (`h-7`), listarivi 40px (`h-10`), osion otsikkorivi 36–40px. Tämä saa lomakkeet ja työkalurivit linjautumaan ilman erillistä säätöä.

---

## 4. Ikonit

Yksi `Icon`-komponentti, yksi polkukokoelma, yksi ruudukko.

- **Lähde: [Lucide](https://lucide.dev)** (ISC-lisenssi). Kopioi vain käytössä olevat polut tiedostoon — ei riippuvuutta, ei käyttämätöntä SVG:tä bundlessa. Säilytä lisenssimerkintä tiedoston alussa.
- 24×24 ruudukko, viivanpaksuus 2, pyöristetyt päät ja liitokset.
- `currentColor` aina — ikoni perii tekstin värin, jolloin se toimii molemmissa teemoissa ilman erillistä logiikkaa.
- Koot: `w-4 h-4` (16px) oletus, `w-3.5 h-3.5` pienissä napeissa, `w-5 h-5` tyhjissä tiloissa.

```jsx
const PATHS = { plus: 'M5 12h14 M12 5v14', /* … */ }

export default function Icon({ name, className = 'w-4 h-4', strokeWidth = 2 }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
```

**Älä piirrä ikoneita käsin.** Kokeiltiin; viivanpaksuus ja optinen koko heittelivät ikonien välillä, ja ratas näytti siltä miltä käsin piirretty ratas näyttää.

---

## 5. Sovellusrunko (Electron)

```
┌──────────────────────────────────────────────────────────┐
│ Titlebar 40px   [työtila ▾]  polku    [haku] [– □ ×]     │  ← koko rivi drag-alue
├──────────┬───────────────────────────────────────────────┤
│ Sivupalkki│  page-head: otsikko + ensisijainen toiminto  │
│  240px   ├───────────────────────────────────────────────┤
│  navi    │  page-body: ainoa vieritysalue                │
│  lista   │                                               │
│  ⚙ v0.0.0│                                               │
└──────────┴───────────────────────────────────────────────┘
```

- **Titlebar omistaa ikkunanapit.** Jos ne kelluvat sisällön päällä, jokainen sivu joutuu varaamaan niille tilaa — se on virhe joka kertautuu.
- **Yksi vieritysalue kerrallaan.** `page-body` vierittyy, muu ei. Sisäkkäiset vierityspalkit ovat aina virhe paitsi kanban-sarakkeissa.
- **Drag-alueet:** `-webkit-app-region: drag` titlebar-riville, `no-drag` jokaiselle sen sisällä olevalle napille. Muista: `no-drag` pitää olla myös valikoiden triggereissä.
- **Teema natiiviin chromeen:** main-prosessi asettaa `nativeTheme.themeSource` ja ikkunan `backgroundColor` samasta asetuksesta kuin renderer asettaa `data-theme`. Muuten käynnistyksessä välähtää väärä väri.

```js
const THEME_BACKGROUND = { light: '#F6F7F9', dark: '#0D0F12' }

function applyTheme(theme = 'system') {
  nativeTheme.themeSource = ['light', 'dark'].includes(theme) ? theme : 'system'
  const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  win?.setBackgroundColor(THEME_BACKGROUND[resolved])
}
```

---

## 6. Toistuvat mallit

**Sivun otsikko** — `page-head`: vasemmalla otsikko ja yhden rivin selite, oikealla yksi ensisijainen toiminto. Ei ikonia otsikon vieressä, ei eyebrow-tekstiä otsikon yllä. Ne ovat koristetta.

**Työkalurivi** — suodattimet ja näkymävalinnat omalle riville otsikon alle, `border-b border-line`. Chipit tilanvalinnoille, `select.field` moniarvoisille.

**Listarivi** — 40px korkea, `hover:bg-surface-2`, sarakkeet kiinteillä leveyksillä ja `flex-1` sille joka saa kutistua. Numerot `tabular-nums`.

**Tyhjä tila** — yksi lause siitä mitä puuttuu, ja tarvittaessa yksi nappi joka korjaa asian. Ei kuvitusta, ei kolmen rivin selitystä.

**Vahvistus** — poisto ei avaa modaalia. Nappi vaihtuu paikallaan vahvistukseksi (`Poista` → `Vahvista poisto`) tai rivin viereen ilmestyy `Kyllä / Ei`. Modaali varataan sille, mikä oikeasti pysäyttää työn.

**Modaali** — otsikkorivi, sisältö, toimintorivi alas oikealle. Esc sulkee, taustan klikkaus sulkee, fokus vangitaan sisään ja palautetaan sulkiessa. Tuhoava toiminto vasemmalle, jotta se ei ole `Tallenna`-napin vieressä.

**Ilmoitukset** — jokainen epäonnistunut toiminto näyttää toastin. Hiljainen `console.error` on käyttäjän näkökulmasta sama kuin ei mitään: klikkaus ei tehnyt mitään eikä kukaan kerro miksi.

---

## 7. Kieli ja tekstit

- **Kaikki tekstit avaimina** heti alusta: `t('task.add')`. Litteä objekti ja `t()`-funktio riittää; i18n-kirjasto vasta kun toinen kieli ja monikot ovat oikeasti tulossa.
- **Yksi kieli kerrallaan käyttöliittymässä.** Sekakieli ("Workspace" suomenkielisen tekstin seassa) on merkki siitä, ettei kukaan lukenut sivua kokonaan.
- **Virkemuoto, ei otsikkomuoto:** "Uusi projekti", ei "Uusi Projekti".
- **Napit ovat verbejä:** "Luo varmuuskopio", ei "Varmuuskopio".
- **Ikoni kertoo saman kuin teksti.** Valintamerkki tarkoittaa "valmis", ei "luo uusi". Tämä meni ProjectHubissa kerran väärin: varmuuskopion luontinapissa oli valintamerkki.

---

## 8. Saavutettavuus — vähimmäistaso

Nämä eivät ole neuvoteltavissa, ja ne ovat halpoja kun ne tehdään alusta.

```css
:focus-visible {
  outline: 2px solid rgb(var(--c-accent));
  outline-offset: 1px;
  border-radius: 4px;
}
```

- Näppäimistöfokus näkyy aina, hiiriklikkaus ei jätä kehystä.
- Modaali vangitsee fokuksen ja palauttaa sen sulkiessa.
- Ikoninapeilla on `title` ja tarvittaessa `aria-label`.
- Tilaa ei kerrota pelkällä värillä: myöhässä-tehtävässä lukee "3 pv myöhässä", ei pelkkä punainen piste.
- Kontrasti: `muted` teksti tokenien pinnoilla ylittää 4.5:1 molemmissa teemoissa. Jos lisäät värin, tarkista se.

---

## 9. Mitä ei tehdä

Nämä ovat oikeita virheitä ProjectHubin ensimmäisestä versiosta.

| Virhe | Miksi väärin |
|-------|--------------|
| Laatikko laatikossa laatikossa | Kolme reunaa ja kolme varjoa saman sisällön ympärillä. Valitse yksi taso. |
| Gradientit taustoissa, napeissa ja ikoneissa | Sininen, violetti ja oranssi yhtä aikaa ilman että mikään niistä tarkoittaa mitään. |
| Sama luku kahdesti samalla sivulla | Kojelaudassa oli badge-rivi ja korttirivi samoista luvuista. |
| Eyebrow-tekstit ("Overview", "Project") | Kertovat sen, minkä otsikko jo kertoo. |
| Ensisijainen toiminto hoverin takana | Käyttäjä ei löydä sitä koskaan. Tämä maksoi ajanseurannan käyttöasteen. |
| Yhdeksän eri radiusarvoa | Silmä huomaa epäjohdonmukaisuuden vaikkei osaa nimetä sitä. |
| `text-[10px]` ja `0.8125rem` samassa näkymässä | Skaala on olemassa juuri tätä varten. |

---

## 10. Uuden sovelluksen aloitus

1. Kopioi `index.css`:n token- ja komponenttilohkot sekä `tailwind.config.js`.
2. Kopioi `Icon.jsx` ja poista käyttämättömät polut; lisää uudet Lucidesta.
3. Kopioi runko: `TitleBar`, `Sidebar`, `Modal`, `Menu`, `Toaster`.
4. Perusta `i18n.js` ensimmäisestä tekstistä alkaen — jälkikäteen tehtynä se on kymmenen kertaa kalliimpi.
5. Teemakytkin (`useTheme` + `nativeTheme`) ennen ensimmäistä sivua, ei sen jälkeen.
6. Tarkista lopuksi: onko sovelluksessa yhtään kovakoodattua väriä, yhtään uutta fonttikokoa tai yhtään hoverin taakse piilotettua ensisijaista toimintoa. Jos on, korjaa ennen kuin ne kertautuvat.

---

## 11. Tekninen pohja

ProjectHubin pino, jonka päällä tämä design toimii:

| Osa | Valinta | Miksi |
|-----|---------|-------|
| Runko | Electron + electron-vite | Työpöytäsovellus, natiivi tiedostojärjestelmä ja ilmoitukset |
| Käyttöliittymä | React 18 | — |
| Tyylit | Tailwind + CSS-muuttujat | Tokenit yhdessä paikassa, luokat komponenteissa |
| Data | better-sqlite3, versioidut migraatiot | Paikallinen, ei palvelinta |
| Testit | Vitest | `node:sqlite` alias testeissä, koska ajuri on käännetty Electronin ABI:a vasten |
| Tyypit | `api.d.ts` + `jsconfig.json` | IntelliSense ilman TypeScript-migraatiota |

---

*Kirjattu ProjectHub 0.6.1:n pohjalta. Kun tätä käytetään uudessa sovelluksessa ja jokin sääntö osoittautuu vääräksi, korjaa se tänne — muuten seuraava sovellus toistaa saman virheen.*
