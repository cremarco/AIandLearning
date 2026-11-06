# Verifica fattuale delle 198 slide — 6 novembre 2026

Revisione della presentazione completa a partire dal commit `64b9aad`, con successiva integrazione e nuovo controllo del commit remoto `dde2a29`. Tutte le 198 slide sono state esaminate; gli errori individuati e le precisazioni necessarie sono stati applicati ai dati sorgente e ai materiali generati. Non sono emerse ulteriori discrepanze fattuali nel controllo indipendente delle correzioni. Questo esito riguarda l'ambito descritto sotto, non certifica ogni fotogramma delle registrazioni o ogni stato nascosto dei widget.

Il [registro per slide](../../data/references/factual-slide-audit.json) contiene esattamente 198 righe, numero e ID, categoria dell'informazione, controlli effettuati, fonti, correzioni e limiti conservati. Include gli hash dei file esaminati: una modifica successiva rende la verifica storica, non automaticamente valida per i nuovi contenuti.

## Controlli incrociati

| Passaggio | Copertura e criterio |
| --- | --- |
| Fonti scientifiche e accessibilità | 39 slide esaminate nel merito; ulteriori 83 slide controllate per promesse didattiche improprie. Separazione tra definizioni, risultati sperimentali e consigli del workshop. |
| Tool | 75 ID, 21 gruppi di strumenti. Documentazione e piani ufficiali confrontati con il comportamento effettivamente documentato nelle demo. |
| Shortcut e skill | 102 ID; tutte le 79 schede, 17 pacchetti, 6 demo e relativi output; controllo di classificazioni, spiegazioni tecniche, benchmark e riferimenti. |
| Controllo indipendente trasversale | Lettura del testo di tutte le 198 slide, senza consultare prima i rapporti degli altri revisori; approfondimento esterno di 15 famiglie di affermazioni a maggior rischio. |
| Apertura e contesto | Controllo aggiuntivo di 12 ID: relatore, organizzazione, programmi originali, libro dichiaratamente fittizio, legenda, QR e separatori. |
| Verifica delle correzioni | Secondo esame indipendente di 10 slide e dei metadati pertinenti; verifica separata della pratica revisionata e degli hash dei 6 artefatti originali. |
| Aggiornamento remoto | 31 ID ricontrollati: 30 nuove registrazioni isolate e il riuso della relativa demo worksheet. Rilettura indipendente di tutte le nuove trascrizioni; confronto con provenienza e didascalie, oltre alla rilettura delle modifiche di testo. |
| Controlli tecnici e interfaccia | Riproduzione nel browser dei due errori del quiz; prova di punteggio manuale, reset e layout mobile della copia revisionata; verifica visiva di slide corrette e bibliografia. |

Le coperture si sovrappongono. Una slide di titolo è verificata per coerenza editoriale e identificazione, non classificata come risultato scientifico. La scansione di tutte le slide non equivale al controllo esterno di ogni parola di ogni registrazione.

## Correzioni applicate

| Caso | Intervento |
| --- | --- |
| Shortcut, S53TYPES e S53SHORTCUTCLOUD | Eliminata la frase secondo cui 49 output statici erano stati rimossi: sono documentati nelle schede individuali. Distinte le 30 voci interattive delle tabelle dalle 79 schede complessive. |
| Learning Skill, S53SKILLLEARNING | Segnalata sulla slide la correzione automatica inaffidabile del quiz originale. Aggiunta una [pratica revisionata](../../public/materials/skills/outputs/chapter-quiz-reviewed.html), separata e dichiarata come adattamento successivo alla registrazione. Gli originali rimangono disponibili. |
| Inferenza, S65 | Sostituito il model card poco pertinente con il capitolo assegnato per la distinzione tra contesto e aggiornamento dei parametri. |
| Demo slide, S67SLIDES | Il titolo ora descrive generazione e presentazione. La revisione non fu eseguita: furono ispezionati i controlli. Registrazione e trascrizione non sono state riscritte. |
| Gemini Notebook, S61DEEP/S67INFO/S67SLIDES/S97 | Esplicitate le restrizioni per account adulti delle funzioni pertinenti. Per le slide, indicato che le revisioni non tengono conto delle fonti e consumano la quota. Fonti dedicate: [scoperta delle fonti](https://support.google.com/gemininotebook/answer/16215270?hl=en), [infografiche](https://support.google.com/gemininotebook/answer/16758265?hl=en), [slide deck](https://support.google.com/gemininotebook/answer/16757456?hl=en). |
| Formative, S97P | Precisato che la voce a pagamento riguarda risposte audio/video: la formulazione generica “media” comprendeva anche contenuti disponibili nel piano gratuito. [Matrice ufficiale dei piani](https://help.formative.com/en/articles/6827953-what-formative-plan-is-best-for-me). |
| Bibliografia, S99 | Aggiunte le definizioni già citate di autovalutazione e apprendimento autodiretto; 18 voci complessive. Riallineati registro di verifica, file scaricabile e slide. Aggiunto il DOI fornito dall'editore per Ouyang et al. (2022). |
| Risorse, S102 | Collegata la versione WCAG del 2023 coerente con la data citata; aggiornato il titolo del manuale Apple. |
| Nuove flashcard e Pomodoro, S53DETAILFLASHCARD/S53DETAILPOMODORO | Esplicitati i punteggi autoassegnati e la promessa non verificata di ripasso tra chat; nel Pomodoro il countdown non fu validato e il comando +1 min mostrò un risultato errato. La slide raccomanda un timer separato. |
| Installazione delle skill, guida scaricabile | Le sei istruzioni di importazione web sono ora dichiarate come osservate nell'account dell'autore il 5 novembre, con disponibilità dipendente dall'account. Non sono istruzioni universali. |

### Difetto del quiz e verifica della correzione

Nel quiz originale, alla prima domanda “Not parameters; training only changes the prompt.” viene accettata perché contiene una parola chiave. Alla terza, una parafrasi corretta del RAG viene respinta perché non contiene l'intera frase attesa. Entrambi i casi sono stati riprodotti nell'interfaccia del browser.

La copia revisionata non assegna voti analizzando il testo: mostra criteri e risposta di riferimento, poi richiede un'autovalutazione esplicita 0/1/2. Scrivere risposte non cambia il punteggio; scegliere manualmente 2 in un item produce 2/6 con 1/3 item valutati; il reset riporta a 0/6 e 0/3. Il totale è una registrazione di pratica, non una misura validata di padronanza. Le tre risposte di riferimento sono state confrontate indipendentemente con §§1.2 e 1.7 del libro. Hash dei 6 output originali e trascrizioni invariati.

### Controllo delle nuove registrazioni integrate

Durante il push è stato rilevato un aggiornamento remoto con 30 nuove registrazioni. È stato integrato senza sovrascriverlo. Le 31 modifiche di slide sono state ricontrollate; tutte le 30 trascrizioni sono state rilette dal revisore indipendente, con ulteriori letture mirate del coordinatore. Gli hash dei 30 video corrispondono al manifesto; le trascrizioni corrispondono ai metadati; i 30 fingerprint distinti documentano chat temporanee inizialmente vuote. Questi riscontri controllano integrità e provenienza, non efficacia didattica.

Le intestazioni effettive dei flussi video, lette con FFmpeg, confermano 1440×900 a 60 fps per tutte le 30 registrazioni. Due limiti ora visibili nelle nuove registrazioni richiedono una nota adiacente: promessa di ripassi da altre chat non verificata nelle flashcard e comportamento errato del pulsante +1 min nel Pomodoro. Le note sono state verificate anche nell'interfaccia. Non sono stati alterati i video o le trascrizioni ricevuti dal remoto. Le valutazioni manuali e i check di completamento non sono trattati come correzione semantica o misura di padronanza.

## Riscontri scientifici principali

- **Kestin et al.**: la slide conserva il contesto di 194 studenti eleggibili, due lezioni di fisica e verifiche immediate con tutor costruito appositamente. Non estende il risultato a qualsiasi chatbot o alla ritenzione nel tempo. [Articolo](https://www.nature.com/articles/s41598-025-97652-6).
- **Deng et al.**: confermati 69 studi nella revisione e 62 nella meta-analisi. Restano visibili eterogeneità, problemi di valutazione e limiti delle conclusioni sull'apprendimento durevole. L'accesso diretto del revisore al sito editore era limitato; è stato consultato anche il testo indicizzato dell'editore. [Articolo](https://doi.org/10.1016/j.compedu.2024.105224).
- **Bastani et al.**: +48% durante la pratica e −17% nella verifica autonoma sono variazioni relative al controllo, non punti percentuali. La verifica seguiva la pratica; non è una prova di ritenzione a lungo termine. La correzione editoriale del 2025 riguarda un'affiliazione. [Articolo](https://www.pnas.org/doi/10.1073/pnas.2422633122), [correzione](https://www.pnas.org/doi/10.1073/pnas.2518204122).
- **Definizioni**: apprendimento autodiretto supportato dalla [voce MeSH NLM](https://www.ncbi.nlm.nih.gov/mesh/2023167), che attribuisce la definizione a Knowles; autovalutazione formativa supportata da [Andrade, 2019](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00087/full). Il volume originale di Knowles non è stato presentato come consultato direttamente.
- **Spiegazioni tecniche e benchmark**: non individuate contraddizioni sostanziali nelle spiegazioni visibili di training, inferenza ordinaria, contesto, RAG, token, temperatura e attenzione causale. I riferimenti a Transformer, RLHF e RAG sono stati confrontati con gli atti primari. I benchmark delle skill rimangono distinti da una misura dell'apprendimento degli studenti.
- **Accessibilità**: le fonti sostengono le strategie suggerite; questo controllo non certifica conformità WCAG del progetto o efficacia clinica per una diagnosi.

## Fonti, controlli automatici e limiti

Il controllo HTTP ha interessato 103 URL pubblici unici del registro iniziale: 95 risposte 200, 8 risposte 403. Sono esclusi conversazioni private, Drive, file locali e nuove fonti aggiunte durante questa revisione. Un 200 non dimostra la correttezza di una frase; un 403 non dimostra che una fonte sia errata o inesistente. Le limitazioni interessano Bastani, retrieval practice, UNESCO, Transformer Explainer, Desmos, skill ChatGPT e limiti MindMeister; sono state usate fonti primarie alternative o versioni ufficiali indicizzate, mantenendo i limiti nel registro.

Il validatore BibTeX restituisce 18 voci valide, zero errori e zero duplicati. Restano 7 avvisi per il campo facoltativo `pages`, soprattutto dove si usano numeri di articolo; non sono state inventate pagine. Il controllo dati ora impedisce che hash e conteggi del registro bibliografico divergano dal file consegnato.

I tre programmi originali sono stati riletti tramite Google Drive. Date, stanze e orari sono coerenti. L'orario dell'intero evento MRU non viene attribuito alla singola relazione. La città Druskininkai deriva dal brief dell'autore, non è esplicitata nel PDF del programma. Il ruolo attuale del relatore è supportato dal CV personale e dal programma; non è una certificazione indipendente dell'inquadramento contrattuale.

Non sono state inviate nuove richieste ai servizi AI, né ripetute tutte le demo con account autenticati. Video, nomi storici dei prodotti e output originali documentano le prove precedenti. Eventuali promesse del modello su ripassi da altre chat, pianificazione automatica o padronanza dopo tre risposte restano testo storico non validato e non sono adottate come capacità dimostrate. Le condizioni commerciali e di accesso sono fotografate al 6 novembre 2026.

Questa verifica non è una revisione sistematica della letteratura, una valutazione formale del rischio di bias o una ri-analisi dei dati sperimentali. I rapporti analitici e le prove HTTP sono conservati localmente in `output/review/factual-audit/`; il registro versionato documenta copertura, fonti, esiti e limiti senza pubblicare i testi integrali dei programmi.

## Esito dei controlli finali

- `pnpm generate`: generata la sequenza completa di 198 slide e i materiali collegati.
- `pnpm check`: superato; struttura/import, ordine e dati della versione integrata, 52 immagini presenti e utilizzate, 93 riferimenti locali in 18 file HTML/CSS, controlli matematici di probabilità.
- `pnpm build`: superato sulla consegna finale.
- `git diff --check`: nessun errore di whitespace.
- Registro: 198/198 ID nell'ordine effettivo; hash dei quattro file di snapshot corrispondenti alla consegna; sei hash degli artefatti/trascrizione originali corrispondenti alla verifica iniziale.
