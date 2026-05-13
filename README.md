<p align="center">
  <img src="tiksu_bots_trans.png" alt="Tiksu Bots" width="230" />
</p>

# Tiksu Bot Manager

Tiksu Bot Manager on Windows-työpöytäsovellus Discord-bottien hallintaan. Sovelluksella voi lisätä botteja, käynnistää ja pysäyttää niitä, seurata lokeja, hallita `.env`-muuttujia ja päivittää sovelluksen suoraan GitHub Releases -julkaisuista.

## Ominaisuudet

- Lisää ja hallitse useita Discord-botteja samasta näkymästä
- Käynnistä, pysäytä ja uudelleenkäynnistä botit yhdellä klikkauksella
- Reaaliaikaiset lokit ja virhesuodatus
- `.env`-tiedoston tuonti botin asetuksiin
- Automaattinen päivitystarkistus käynnistyksessä ja tunnin välein
- Manuaalinen päivitystarkistus sovelluksen sivupalkista
- Oma tumma Tiksu-otsakepalkki ja sovelluslogo
- Windows-asennusohjelma NSIS-installerilla

## Lataus

Uusin Windows-versio löytyy GitHub Releases -sivulta:

[Lataa uusin Tiksu Bot Manager](https://github.com/Pastorilaine/Tiksu-bot-manager/releases/latest)

Lataa tiedosto, jonka nimi on muodossa:

```text
Tiksu.Bot.Manager.Setup.x.x.x.exe
```

Asenna sovellus normaalisti avaamalla asennustiedosto.

## Päivitykset

Sovellus käyttää `electron-updater`-päivityksiä GitHub Releases -julkaisuista.

- Päivitykset tarkistetaan automaattisesti noin 5 sekuntia sovelluksen käynnistyksen jälkeen
- Sovellus tarkistaa päivitykset uudelleen tunnin välein
- Päivityksen voi tarkistaa myös käsin sivupalkin alareunan **Tarkista**-napista
- Kun päivitys on ladattu, sovellus pyytää käynnistämään uudelleen asennusta varten

## Käyttö

1. Avaa Tiksu Bot Manager.
2. Klikkaa **Lisää botti**.
3. Valitse botin käynnistystiedosto.
4. Tuo tarvittaessa `.env`-tiedosto.
5. Käynnistä botti ja seuraa lokeja pääikkunasta.

Botin asetuksiin tallennetut tiedot pysyvät paikallisesti käyttäjän koneella `electron-store`-tallennuksessa.

## Kehitys

Asenna riippuvuudet:

```bash
npm install
```

Käynnistä kehitystilassa:

```bash
npm run dev
```

Rakenna frontend:

```bash
npm run build
```

Rakenna Windows-asennusohjelma:

```bash
npm run build:app
```

Valmis asennusohjelma luodaan `release/`-kansioon.

## Teknologiat

- Electron
- React
- Vite
- Tailwind CSS
- electron-store
- electron-updater
- electron-builder
- lucide-react

## Julkaisuprosessi

1. Päivitä versio `package.json`-tiedostoon.
2. Aja build:

```bash
npm run build
npx electron-builder
```

3. Luo GitHub Release ja lisää mukaan:

```text
Tiksu.Bot.Manager.Setup.x.x.x.exe
latest.yml
```

`latest.yml` pitää viitata samaan tiedostonimeen, jonka GitHub näyttää assettina. GitHub muuttaa välilyönnit pisteiksi, joten nimi on yleensä muodossa `Tiksu.Bot.Manager.Setup.x.x.x.exe`.

## Lisenssi

Ei julkista lisenssiä määritelty.