# Beyond prompting

Presentazione di Marco Cremaschi per i tre incontri di Vilnius, novembre 2026: strumenti visivi, apprendimento autodiretto e uso responsabile dell’IA. Slide in inglese, copioni del relatore in italiano e in inglese semplice.

Il progetto contiene **44 slide: 41 condivise e 3 schede scientifiche di approfondimento**. I tre percorsi selezionano e ordinano lo stesso materiale, con tempi diversi.

## Avvio e distribuzione

Richiede Node.js **24.12.0 o successivo** e pnpm (versione usata: 11.25.0). Questo minimo copre le dipendenze bloccate nel lockfile anche su Linux; GitHub Actions usa Node.js 24. Dalla cartella del progetto:

```sh
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Aprire [localhost:3030](http://localhost:3030). Per creare il sito statico e il PDF:

```sh
pnpm build
pnpm export
```

Il sito viene generato in `dist/`; il PDF in `exports/EduForum-2026.pdf`. Servire `dist/` tramite un server HTTP statico: aprire `dist/index.html` con `file://` non è supportato.

Il **PDF comprende tutte le 44 slide in ordine statico**: non conserva la selezione dei percorsi, i salti interattivi o il funzionamento dei timer. Per questi usare la versione web.

## GitHub Pages

La versione online è pubblicata su [cremarco.github.io/EduForum](https://cremarco.github.io/EduForum/). Il workflow [github-pages.yml](.github/workflows/github-pages.yml) ricrea e pubblica il sito a ogni push su `main`, oppure può essere avviato manualmente da GitHub Actions.

Il workflow installa le versioni bloccate dal lockfile, rigenera note e alternative testuali, adatta il percorso base alla configurazione Pages e pubblica solo `dist/`. La navigazione usa le rotte hash per conservare i percorsi anche dopo un ricaricamento della pagina. PDF e ZIP locali non sono inclusi nel repository o nel sito.

Configurazione di riferimento: [workflow personalizzati per GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Percorsi e navigazione

Scegliere l’evento dai pulsanti della copertina, oppure aprire un indirizzo diretto:

| Percorso | Durata prevista | Slide nel percorso | URL durante lo sviluppo |
| --- | --- | --- | --- |
| Forum | 90 minuti | 41 | `http://localhost:3030/1?flow=forum` |
| University | 48 minuti | 34 | `http://localhost:3030/1?flow=university` |
| Teachers | 50 minuti | 33 | `http://localhost:3030/1?flow=teachers` |

Nel sito compilato la rotta è dopo il cancelletto: per esempio `http://localhost:8080/#/1?flow=forum`, adattando host e cartella al proprio server. Senza `flow`, o scegliendo **All slides**, si esplorano tutte le 44 slide. Le durate sono tempi di facilitazione previsti, da adattare al gruppo.

- **Tastiera:** frecce sinistra/destra o Pag↑/Pag↓ seguono il percorso selezionato; Spazio avanza quando il focus non è su un controllo. Tab raggiunge pulsanti e link; Invio/Spazio attiva il pulsante selezionato.
- **Numerazione fisica:** ogni slide mostra sempre il proprio numero da **1 / 44** a **44 / 44**, coerente con il PDF e con i copioni. La numerazione resta fissa quando si cambia percorso; lo stato del percorso indica separatamente la posizione nella selezione attiva.
- **Barra di avanzamento:** il bordo inferiore mostra la posizione nel percorso selezionato e si completa sull’ultima slide dell’evento. Le schede scientifiche mantengono la posizione dell’attività da cui si aprono. In All slides e nel PDF segue tutte le 44 slide.
- **Controlli in basso:** compaiono al passaggio del puntatore o quando ricevono il focus. Offrono un selettore del percorso (incluso All slides), Agenda, stato del percorso, indietro e avanti. Sui dispositivi touch restano visibili sotto la slide e includono Text per aprire la versione testuale.
- **Agenda:** le quattro card aprono l’inizio del relativo capitolo nel percorso attivo.
- **Schede scientifiche:** le tre schede finali si aprono dall’attività; **Return to the activity** riporta alla slide S33.
- **Timer:** partono solo con Start. Pause sospende, Reset ripristina il tempo iniziale e +1 min lo estende. I comandi agiscono sulla slide attiva e si sincronizzano tra vista relatore e proiezione. Uscire dalla slide mette il timer in pausa. Il tempo è flessibile e non misura la velocità dei partecipanti.

## Materiali e partecipazione

In `public/materials/` sono disponibili:

- `Accessible_Deck_EN.txt`: equivalente testuale inglese delle slide.
- `Presenter_Notes_IT.txt`: copione italiano completo per tutte le 44 slide.
- `Presenter_Notes_EN.txt`: copione completo in inglese semplice, con frasi brevi, per tutte le 44 slide.
- `activity-packet.txt` e `facilitator-guide-it.txt`: consegne inglesi e guida italiana alle attività.
- `Learning_Path_Workbook_EN.txt`, `Prompt_Bank_EN.txt`, `Evidence_Cards_EN.txt` e `Accessibility_Risk_Checklist_IT.txt`: materiali riutilizzabili per il lavoro in aula.
- `source_index.csv` e `bibliography.bib`: indice delle fonti e bibliografia.

Le attività funzionano su carta o testo digitale, senza account e senza una dimostrazione live di IA. Un compagno può svolgere il ruolo di coach. Le risposte possono essere orali, scritte o dettate; lettori di schermo, sintesi vocale, traduzione e accomodamenti restano disponibili anche nelle verifiche del ragionamento indipendente.

Le alternative testuali e i controlli da tastiera aiutano l’accesso, ma non costituiscono una certificazione di accessibilità. Non è stata svolta una verifica diretta con lettore di schermo: preparare i materiali e gli accomodamenti necessari per il gruppo.

## Copioni del relatore

Le note native di Slidev contengono entrambe le lingue: leggere la sezione della lingua scelta. La scorciatoia **P** è abilitata per aprire e chiudere la vista relatore conservando il parametro `flow` del percorso nell’URL. Nella vista relatore, i controlli nativi indietro/avanti e l’anteprima **Next** seguono il percorso selezionato. I due file `Presenter_Notes_IT.txt` e `Presenter_Notes_EN.txt` permettono anche di prepararsi e leggere una sola lingua fuori dalla presentazione.

Le sezioni **Copione / Script** riportano le parole da pronunciare, comprese consegne, domande e ripresa del lavoro dopo le attività. Le **Azioni / Presenter actions** specificano quando fermarsi, lasciare lavorare il gruppo e riprendere il paragrafo successivo; non vanno lette ad alta voce. Le aggiunte **Solo Forum / Forum only** sono facoltative e riservate al percorso lungo. I riferimenti tecnici e le cautele originali sono separati dal discorso. I tempi includono il lavoro e le risposte dei partecipanti: non richiedono di parlare per l’intera durata della slide.

Per preparare un singolo evento, usare `Presenter_Notes_Forum_IT.txt` / `_EN.txt`, `Presenter_Notes_University_IT.txt` / `_EN.txt` oppure `Presenter_Notes_Teachers_IT.txt` / `_EN.txt`: contengono solo le slide previste, già nell’ordine del relativo percorso, con i tempi. Le aggiunte Forum sono escluse dai copioni dei due incontri brevi. I copioni completi comprendono anche le tre schede scientifiche facoltative.

## Modificare i contenuti

Modificare i dati sorgente, poi rigenerare gli output:

- `data/slides.json`: testi, tipi di slide, riferimenti italiani di preparazione, fonti e durata per evento.
- `data/speaker-notes.json`: parole esatte da pronunciare in italiano e in inglese semplice, azioni separate e aggiunte facoltative per il Forum.
- `data/sources.json`: citazioni, URL degli originali, localizzatori e limiti delle fonti.
- `data/flows.json`: ordine delle slide e configurazione dei tre percorsi.

```sh
node scripts/generate-slides.mjs
node scripts/generate-companions.mjs
```

Il primo comando aggiorna `slides.md`, comprese le note e le finestre temporali; il secondo aggiorna gli equivalenti testuali delle slide e delle note. Evitare modifiche manuali a questi file generati. Dopo le modifiche ricreare sito e PDF con `pnpm build` e `pnpm export`.

Le citazioni sotto le slide aprono le fonti originali; le note conservano gli ID e i riferimenti estesi. La S39 collega il dossier di ricerca e i materiali; nelle sue note è presente anche l’archivio Drive. Conservare i limiti di ogni studio e distinguere risultati sperimentali, linee guida e dichiarazioni dei fornitori. Le attività sono proposte didattiche originali informate dalle fonti, non un metodo integrato già validato.

Le slide concettuali mostrano una breve introduzione e card con spiegazioni, esempi o domande guida in inglese semplice. I sei campi del Learning Path Canvas includono indicazioni per la compilazione. Il campo opzionale `explanation` nei dati contiene il testo introduttivo esteso; viene riportato anche nell’equivalente testuale accessibile. I copioni del relatore restano separati dal testo destinato ai partecipanti.

## Aspetto e immagini

Il tema predefinito è scuro, anche se il sistema operativo è chiaro. Il riferimento resta la presentazione AIPP: tipografia di sistema con SF Pro/Helvetica Neue, forme 3D, card bento e palette bordeaux/arancio/ciano. Il fondo carbone caldo e il testo avorio usano token condivisi; link e focus adottano varianti più luminose degli accenti per preservare il contrasto. Tema e layout sono in `styles/`, le card in `components/BentoCard.vue`.

La slide del relatore riprende il profilo del [sito personale](https://cremarco.github.io/cv/): ritratto autentico, ruolo e aree di ricerca, verificati il 1 novembre 2026. La fotografia è conservata localmente per consentire presentazione ed esportazione anche senza connessione.

`public/images/` contiene sette asset generati con il tool integrato image_gen (compresa la variante di copertina scura già generata) e una grafica di riferimento ripresa dal progetto AIPP (`profile-aipp.png`). Prompt, provenienza e descrizioni alternative proposte sono in [image-prompts.md](image-prompts.md). Le persone raffigurate nelle nuove immagini sono sintetiche e non rappresentano Marco o partecipanti reali.

La slide Whattadata segue la presentazione del relatore in tutti i percorsi. Status e attività sono documentati dal sito ufficiale e dalla scheda istituzionale UniMiB; `public/images/whattadata.svg` è il logo ufficiale. Gli ID delle slide restano stabili quando cambia l’ordine fisico.

La slide Whattadata usa una composizione dedicata al marchio: logo ufficiale anche sullo sfondo, cubi viola/lime ripresi da AIPP e tre ambiti di attività in testo. Le immagini decorative sono conservate localmente e non richiedono una connessione durante la presentazione.
