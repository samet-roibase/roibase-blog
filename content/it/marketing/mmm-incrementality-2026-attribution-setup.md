---
title: "MMM + Incrementality: L'Attribution Setup del 2026"
description: "Robyn, Meta Lift, geo experiments — quando usare cosa? Decision tree pratico per l'attribution post-cookie."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, geo-test]
readingTime: 9
author: Roibase
---

Il tracking cookie è scomparso per l'80%, l'Multi-Touch Attribution (MTA) non è più affidabile, i dashboard delle piattaforme si contraddicono. Nel 2026 i marketer misurano la "contribuzione" combinando due metodi: Marketing Mix Modeling (MMM) e test di incrementalità. Il problema: pochi sanno quando usare quale. Questo articolo ti mostra dove posizionare Robyn (la libreria MMM open source di Meta), Meta Lift API e i test di holdout geografici nello stesso setup.

## Last-touch attribution è morto — ma cosa lo sostituisce?

Google Analytics 4 dice "data-driven attribution", Meta dice "modeled conversions", TikTok fornisce i suoi numeri. Tutti e tre riportano cifre diverse. Nel 2025 un e-commerce che spende 100 euro può vedere 8 conversioni in GA4, 12 in Meta e 6 in TikTok. Quale canale davvero funziona? Il modello last-touch non risponde perché l'utente passa per più touchpoint e ogni piattaforma si attribuisce il merito.

Il Marketing Mix Modeling risolve il problema da un'angolazione diversa: prende i canali come variabili indipendenti, le vendite o il revenue come variabile dipendente, e usa la regressione per calcolare il contributo marginale di ogni canale. I test di incrementalità sono più diretti: esponi un gruppo a un canale, l'altro gruppo non lo esponi, misuri la differenza. Entrambi sfondano l'illusione del last-touch, ma i loro scenari d'uso non si sovrappongono.

La differenza sta qui: MMM è macro (lungo termine, tutti i canali), incrementalità è micro (breve termine, canale o campagna specifica). Nel 2026 uno setup che combina entrambi è diventato standard.

## MMM: setup di regressione settimanale con Robyn

La libreria Robyn di Meta è il framework MMM open source del team di Facebook Marketing Science. Funziona con R, usa la regressione Bayesiana ridge, e adatta automaticamente curve di adstock (effetto ritardato) e saturazione (rendimento decrescente). Fornisce la contribuzione settimanale di ogni canale — TV, display, paid social, SEO, email — al totale vendite in percentuale.

**I 4 componenti del setup Robyn:**

1. **Raccolta dati:** Minimo 1,5 anni di dati settimanali. Ogni riga = una settimana. Colonne: spesa per ogni canale, impressioni o click; variabili indipendenti (prezzo, scorte, stagionalità); variabile dipendente (revenue, ordini, conversioni). Se mancano dati il modello fallisce.
2. **Hyperparameter tuning:** Robyn cerca per ogni canale il parametro adstock decay (α) e la forma di saturazione (γ). Esegue 2000+ combinazioni di modelli e suggerisce i migliori 5-10 dalla frontiera di Pareto. Questa fase impiega 10-30 minuti (su 64 core).
3. **Selezione del modello:** Prendi il modello con NRMSE più basso (Normalized Root Mean Squared Error) + decomp.rssd più alto (stabilità della decomposizione). L'output: contribuzione percentuale di ogni canale al totale vendite, stima ROI, allocazione ottimale budget.
4. **Allocazione budget:** La funzione "budget allocator" di Robyn ridistribuisce il budget totale per equalizzare il ROI marginale di ogni canale. Usi questo output per pianificare il prossimo trimestre.

**Quando usare Robyn:**
- Decisioni di allocazione budget tra canali (es. piano Q3)
- Simulazione aggiunta/rimozione canale
- Analisi trend lungo termine (6 mesi+)

**Quando NON usare Robyn:**
- Ottimizzazione all'interno di una campagna (periodi < 2 settimane)
- Decisioni su creative specifiche (MMM non vede le differenze creative)
- Feedback real-time per bidding (lag settimanale)

Roibase integra Robyn nel suo servizio [Dijital Pazarlama](https://www.roibase.com.tr/it/dijitalpazarlama): colleghi GA4, GTM server-side, Meta CAPI e BigQuery, costruisce la pipeline ETL settimanale, visualizza l'output in Data Studio.

## Test di incrementalità: Meta Lift e holdout geografico

MMM risponde "quanto?", l'incrementalità risponde "davvero funziona?". Due domande diverse. Se spendi 100mila euro in Meta e ottieni 120 conversioni è "buono"? MMM dice "Meta ottiene il 15% del tuo budget e produce il 12% delle vendite totali". Ma quante conversioni avrebbero comunque avuto luogo (organic)? Per questo serve il test di incrementalità.

### Meta Conversion Lift

Meta Lift API misura l'**impatto reale** degli annunci Facebook e Instagram. Come? Crea un piccolo gruppo di holdout che non vede la campagna, un altro che la vede, misura la differenza dopo 7-14 giorni. La differenza = conversioni incrementali.

**Setup:**
- Apri il Lift study prima che la campagna parta (Ads Manager > Measure & Report > Conversion Lift)
- L'holdout è il 5-10% (troppo piccolo = rumore, troppo grande = impressioni perse)
- Durata minima 7 giorni (meno = potenza statistica insufficiente)
- Risultato: conversioni incrementali, CPA incrementale, intervallo di confidenza

**Esempio di interpretazione:**
Gruppo di controllo: 1000 persone, 40 conversioni
Gruppo test: 9000 persone, 450 conversioni
Conversione incrementale = (450/9000 - 40/1000) × 9000 = 90 conversioni
Lift = 90 / (450 - 90) = 25%

Quindi delle 450 conversioni che la campagna ha ottenuto, solo 90 vengono davvero dall'annuncio. Le altre le avrebbero fatte comunque. CPA incrementale = (spesa) / 90. Questo numero è tipicamente il 30-60% più alto dell'MTA — perché è reale.

**Quando usare Meta Lift:**
- A/B test di nuove campagne o creative
- Decisione di canale (Meta vs. Google vs. TikTok, chi è più incrementale?)
- Misurare il vero impatto del retargeting (problema frequente: retargeting mostra sempre CPA basso ma il 80% avrebbe convertito comunque)

**Svantaggio:**
- Funziona solo in Meta (Google ha Google Display & Video 360 ma limitato)
- Creare il gruppo di holdout significa impressioni perse (revenue cala nel breve)
- Minimo 1 settimana di test — non adatto a decisioni giornaliere

### Test geografici (holdout geografico)

Per canali oltre Meta — Google, TikTok, TV — fai test geografici: campagna attiva in alcune città, disattiva in altre, confronti vendite. È il metodo più pulito accademicamente perché non c'è manipolazione a livello utente.

**Esempio di setup:**
- Seleziona 30 città (popolazione, livello economico simili)
- Attiva la campagna Google Ads in 15, la mantieni spenta in 15 (randomizzato)
- Aspetta 4 settimane
- Confronta conversioni per città in Google Analytics 4

**Analisi:**
- Città trattate: media 120 conversioni/città
- Città di controllo: media 95 conversioni/città
- Lift incrementale: (120 - 95) / 95 = 26,3%

Generalizzi questo lift al resto del paese. Se la spesa Google Ads è stata 200mila euro calcoli revenue incrementale e ROAS incrementale.

**Quando usare il test geografico:**
- Misurare il contributo netto di ogni canale in setup multi-channel
- Vedere l'impatto di canali non digitali — TV, OOH, podcast
- Quando non ti fidi dei numeri del dashboard della piattaforma

**Svantaggio:**
- Poche città = potenza statistica bassa (minimo 20 città)
- Se c'è eterogeneità geografica il risultato è fuorviante (Istanbul e Şanlıurfa non sono comparabili)
- Lungo (4-8 settimane)

## Decision tree: quale metodo usare quando?

Organizzi i tre metodi nello stesso setup così:

| Scenario | Metodo | Frequenza | Output |
|----------|--------|-----------|--------|
| Allocazione budget trimestrale | Robyn MMM | 1 volta ogni 3 mesi | ROI per canale, spend ottimale |
| Test nuova campagna (Meta/Instagram) | Meta Lift | Ogni grande campagna | CPA incrementale |
| Incrementalità cross-channel | Holdout geografico | 2 volte l'anno | Lift reale per canale |
| Decisione creative refresh | Meta Lift + analisi CRO | 1 volta al mese | Quale creative è incrementale |
| Real-time bidding | API piattaforma (feedback ROAS) | Giornaliero | Ottimizzazione tattica |

**Flusso pratico:**
1. **Settimanale:** Monitora i dashboard delle piattaforme (simile a MTA ma senza fiducia cieca)
2. **Mensile:** Testa le grandi campagne con Meta Lift
3. **Trimestrale:** Usa Robyn per modellare il contributo lungo termine di tutti i canali e ridistribuisci il budget
4. **2 volte l'anno:** Conferma il lift reale di ogni canale con un test geografico

Con questo setup a 3 livelli prendi decisioni tattiche (quale creative funziona) e strategiche (quale canale merita quanto budget) basate su dati.

## Errori comuni e trade-off

**Errore 1:** "Se faccio MMM non serve il test di incrementalità"
Sbagliato. MMM mostra correlazione, assume causalità. Il test di incrementalità misura causalità. Si completano. Esempio: MMM dice "Instagram contribuisce il 15%", il test Lift mostra che il 40% sarebbe organic. Allora il vero contributo è il 9%.

**Errore 2:** "Faccio il test di incrementalità per ogni campagna"
Sbagliato. Creare un holdout significa impressioni perse. Fai test solo per decisioni grandi (nuovo canale, nuova direzione creativa, strategia retargeting). Per piccole ottimizzazioni basta A/B test.

**Errore 3:** "Robyn si configura una volta e poi gira da solo"
Sbagliato. Il modello si rieducava ogni trimestre. Se aggiungi un canale, cambia il prezzo, la stagionalità varia — il modello va aggiornato. Robyn richiede manutenzione continua.

**Trade-off 1: Velocità vs. precisione**
MMM chiede 1,5 anni di dati, il risultato ha lag 1 settimana. Il test geografico impiega 4-8 settimane. Se devi decidere velocemente devi fidarti del dashboard della piattaforma (con 30-50% margine di errore).

**Trade-off 2: Granularità vs. dimensione campione**
Se il test geografico è per città il campione è piccolo, intervallo di confidenza ampio. Se per provincia aumenta l'eterogeneità. MMM settimanale non risponde a domande giornaliere. Ogni metodo ha limiti di risoluzione.

## Come costruire l'attribution stack nel 2026

Il setup tecnico si compone di:

1. **GTM server-side + first-party cookie:** Invia segnali puliti a GA4 e Meta CAPI (non bypass ATT, ma arricchimento dati basato su consenso)
2. **Data warehouse BigQuery:** Centralizza tutti i dati (GA4, Meta Ads API, Google Ads API, TikTok Ads API, CRM)
3. **Trasformazione dbt:** Crea tabelle aggregate settimanali (ogni riga = 1 settimana, ogni colonna = spesa canale + outcome)
4. **Pipeline Robyn:** Esegui lo script R su Cloud Run una volta a settimana, scrivi output in BigQuery
5. **Dashboard Looker Studio:** Output MMM + numeri MTA piattaforme + risultati test di incrementalità fianco a fianco
6. **Alert Slack:** Se NRMSE del modello supera il 10% avviso di anomalia dati

Questo stack richiede 4-6 settimane per essere costruito. Poi 2-3 ore di manutenzione settimanale. ROI: l'allocazione budget diventa il 15-25% più efficiente (Robyn stesso riporta il 18% di miglioramento nei benchmark).

## Cosa fare adesso

Se ancora decidi con l'attribution last-touch nel 2026 non sarai competitivo. Primo passo: fai fluire i dati delle piattaforme in BigQuery, crea la tabella settimanale storica da 1,5 anni. Secondo passo: configura Robyn, addestra il primo modello. Terzo passo: quando lanci la prossima grande campagna apri uno studio Meta Lift. Quarto passo: tra 6 mesi conferma il lift cross-channel con un test geografico. Questi 4 step portano il tuo attribution stack dalla fallacia MTA a una base di incrementalità reale.