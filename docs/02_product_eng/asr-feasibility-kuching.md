---
project: Sarpply
pillar: 02_product_eng
version: 1.0
status: findings
question: Can a production speech-to-text pipeline transcribe Kuching Hokkien and Sarawak Malay hawker ordering speech well enough to extract six SKU codes and quantities?
applies_to: ADR-0004, PRD FR-2.3, TRD §2.2, Backend Schema `preferred_language`
researched: 2026-10-27
---

# ASR feasibility: Kuching Hokkien and Sarawak Malay voice ordering

**Answer: no, not as open-vocabulary transcription.** No commercial speech-to-text service in this review accepts a Hokkien, Min Nan, or Taiwanese-language code. Every provider offers Mandarin (including a Taiwanese-Mandarin `zh-TW` locale), Cantonese, and Malay — none offers Southern Min. Measured zero-shot character error rate for Whisper on Hokkien audio is **96.6% CER**, which is not a degraded transcript but an unusable one.

**A constrained-vocabulary classifier is a different question, and the evidence there is much better.** Where the output is a closed set of intents or SKUs rather than free text, Hokkien speech recognition becomes tractable — but still needs a purpose-trained acoustic model, which does not exist for Kuching Hokkien. See §5.

Sarawak Malay is the tractable half: `ms-MY` and `ms` are supported everywhere, but dialect-transfer work reports **~69% WER** on Sarawak Malay against a standard-Malay model, so standard Malay is a starting point, not a solution.

---

## 1. Scope and method

The pipeline in question is: a Stall sends a WhatsApp voice note in Kuching Hokkien, Sarawak Malay, or Mandarin; the system must produce `[{sku_code, bundles_ordered}]` against the closed Golden 6 catalogue (`A1`, `A2`, `B1`, `C1`, `D1`, `E1`) per PRD §4 and TRD §2.2.

Three facts shape everything below:

1. **The output vocabulary is tiny and closed.** Six SKU codes and positive integers. The hard part is not language modelling, it is getting a 2-token alphanumeric code and a numeral right, every time, in a noisy kopitiam.
2. **The input language is unwritten.** ADR-0004 rests on this: Hokkien has no practical written form for this audience, so there is no ground-truth text to transcribe *into*. This is a structural problem for any transcription-first architecture, not a tuning problem.
3. **An order commits money.** Per ADR-0002, Ordered Bundles freeze at Cutoff. A mis-transcribed voice note does not produce a bad subtitle; it produces a wrong carton purchase and a wrong delivery.

Method: I queried each provider's published language/locale list and read the specific language-code fields. Where accuracy figures exist, they are quoted with the metric the paper reports (CER for character-based Chinese, WER for word-based Malay). Figures are for Taiwanese or mainland Southern Min, never for Kuching Hokkien — no such measurement exists (§2.4).

---

## 2. Which commercial ASR services publish Hokkien / Min Nan support

### 2.1 Provider support table

Legend: **Yes** = a documented language code that selects a Southern-Min acoustic model. **No** = provider publishes a locale/model list and Southern Min is absent from it. **Unclear** = the provider offers Taiwanese speech recognition but publishes no language code and no accuracy contract.

| Provider | Model / API | Hokkien or Min Nan? | Language code(s) actually accepted | What the code selects instead | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `whisper-1` | **No** | `zh`, `yue`, `ms` + 97 others in the `LANGUAGES` dict; **no `nan`, `nan-TW`, `hokkien`, `min nan`, or `taiwanese` key** | `zh` = Mandarin. Aliases map `cantonese`→`yue`, `mandarin`→`zh`; nothing maps to Southern Min | [whisper/tokenizer.py](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py) |
| **OpenAI** | `gpt-4o-transcribe` | **No** | Deprecated; shuts down **2027-02-26** | Same Whisper-lineage language set | [Transcription guide](https://developers.openai.com/api/docs/guides/transcription) |
| **OpenAI** | `gpt-transcribe` (current recommended) | **No** | ISO 639-1; "selected ISO 639-3 codes, such as `eng`, `spa`, `yue`, and `cmn`"; regional `zh-cn`, `zh-tw`, `zh-hk` | `cmn` and `zh-tw` = Mandarin. No `nan` | [Speech-to-text § Supported languages](https://developers.openai.com/api/docs/guides/speech-to-text#supported-languages) |
| **Google Cloud** | Speech-to-Text v2 (`chirp`, `chirp_2`, `chirp_3`) | **No** | `cmn-Hans-CN`, `cmn-Hant-TW`, `yue-Hant-HK`, `ms-MY`, `wuu-CN`-equivalents; **no `nan-*` row in the full locale list** | `cmn-Hant-TW` is labelled *"Chinese, Mandarin (Traditional, Taiwan)"* — Taiwanese **Mandarin**, not Taiwanese Hokkien | [Supported languages](https://cloud.google.com/speech-to-text/docs/supported-languages) |
| **Microsoft Azure** | Speech to Text | **No** | `zh-CN`, `zh-TW`, `yue-CN`, `wuu-CN`, `ms-MY`; **zero occurrences of "nan", "Hokkien", or "Min Nan" in the locale table** | `zh-TW` is labelled *"Chinese (Taiwanese Mandarin, Traditional)"*; `yue-CN` is Cantonese; `wuu-CN` is Wu | [Language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt) |
| **ElevenLabs** | Scribe v2 | **No** | ISO-639-3 set incl. `cmn` (Mandarin), `yue` (Cantonese), `msa` (Malay); **no `nan`** | `cmn` = Mandarin. Taiwanese Hokkien absent from both the 90+ list and the per-language WER table | [Speech to text](https://elevenlabs.io/docs/capabilities/speech-to-text) |
| **Deepgram** | `nova-3` / `nova-3-general` | **No** | `zh`, `zh-CN`, `zh-Hans`, `zh-Hant`, `zh-TW`, `zh-HK`, `ms`; **no `nan`** | `zh-TW`/`zh-Hant` = Mandarin in Traditional script; `zh-HK` = Cantonese | [Models & languages](https://developers.deepgram.com/docs/models-languages-overview) |
| **AssemblyAI** | Universal-2 (99 langs), Universal-3.5/3.6 Pro (18–32 langs) | **No** | `zh` (Mandarin), `yue` (Cantonese), `ms` (Malay); accepted-code list contains no `nan` | `zh` = Mandarin | [Supported languages](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/supported-languages) |
| **Yating (雅婷逐字稿)** | Commercial Taiwanese ASR, non-public API codes | **Unclear** | No published language code; marketed as a Taiwanese (Taigi) transcription product | Benchmarked as a Taigi system at **32.11% CER** — see §2.2. Closest thing to a commercial Hokkien engine found | [Breeze Taigi benchmark](https://arxiv.org/abs/2603.19259) |

**Reading of the table:** 8 of 9 providers offer a *Taiwanese* locale code, and in every single case that code selects Taiwanese **Mandarin**. This is the specific trap for this project: `zh-TW` / `cmn-Hant-TW` looks like the right box to tick and is not. Southern Min is a separate Sinitic branch, not a Mandarin accent; the Breeze Taigi paper states plainly that Taigi and Mandarin "are distinct phonological systems and are not mutually intelligible spoken languages" and that Hokkien "remain[s] underrepresented" in large-scale multilingual efforts like Whisper ([arXiv:2603.19259](https://arxiv.org/abs/2603.19259)).

### 2.2 Published accuracy figures

**There is no published WER or CER for Kuching Hokkien, Penang Hokkien, or any Malaysian Hokkien variety.** I searched provider documentation, ACL Anthology, arXiv, ISCA Archive and the UNIMAS institutional repository and found no such measurement. Every figure below is Taiwanese or mainland Southern Min.

| Figure | Value | Metric | System | Conditions | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Whisper, zero-shot, Hokkien** | **96.6%** (Medium) / **96.7%** (Large-v2) | CER | Stock Whisper, unmodified | Common Voice `nan-tw`, Taiwanese Hokkien | [Hsieh et al., ROCLING 2023](https://aclanthology.org/2023.rocling-1.25/) |
| Whisper, fine-tuned, Hokkien | 50.9% (Medium) / 52.8% (Large-v2) | CER | Same models after fine-tuning on `nan-tw` | Fine-tuned specifically for Taigi | [Hsieh et al. 2023](https://aclanthology.org/2023.rocling-1.25/) |
| Whisper, fine-tuned, TV drama | **50.7%** best | CER | Large-v2 fine-tuned, 800 h drama + CommonVoice | Best of several configs; 30 s utterance segments | [Hsieh et al. 2023](https://aclanthology.org/2023.rocling-1.25/) |
| Best available Taigi ASR | **30.13%** | CER | BreezeASR-Taigi, fine-tuned on 10,000 h synthetic Taigi | 30 curated samples; per-sample range 14.49%–52.78% | [Breeze Taigi, arXiv:2603.19259](https://arxiv.org/abs/2603.19259) |
| Commercial Taigi ASR | **32.11%** | CER | Yating (雅婷逐字稿) | Same 30 samples | [Breeze Taigi](https://arxiv.org/abs/2603.19259) |
| Whisper-large-v2 tuned for *Taiwanese Mandarin*, run on Taigi | **49.99%** | CER | Breeze ASR 25 | Same 30 samples; per-sample 30.71%–76.85% | [Breeze Taigi](https://arxiv.org/abs/2603.19259) |
| Gemini 3 Flash | 32.52% | CER | Google multimodal model | Same 30 samples, via translated Mandarin output | [Breeze Taigi](https://arxiv.org/abs/2603.19259) |
| Purpose-trained Southern Min ASR | **20.21%** best | CER | HuBERT-large, CTC, trained on 1,778 h labelled MinSpeech | Corpus is mainland Fujian/Taiwan Southern Min; Mandarin text labels | [MinSpeech, Interspeech 2024](https://www.isca-archive.org/interspeech_2024/lin24m_interspeech.pdf) |
| Sarawak Malay, standard-Malay transfer model | **~69%** | WER | Dialect model via transfer learning from standard Malay | See §4.2 — full text not retrievable; mapping of the two values to the two dialects is inferred, not confirmed | [Tan et al., Pertanika JST 32(4), 2024](https://doi.org/10.47836/pjst.32.4.06) |

**A figure is missing where it matters most.** Note that no row exists for a *peninsular Malaysian or Sarawakian Hokkien* corpus, and none for hawker/ordering-domain speech. The Breeze Taigi benchmark itself warns that its absolute values are indicative only, because it scores Taigi audio against Mandarin reference text: "absolute CER values should be interpreted carefully — a perfect Taigi ASR system would not necessarily achieve 0% CER" ([arXiv:2603.19259](https://arxiv.org/abs/2603.19259)).

### 2.3 What 96.6% CER means for this pipeline

96.6% is not "needs improvement". On Common Voice `nan-tw`, unmodified Whisper retained roughly **3 characters in 100** ([Hsieh et al. 2023](https://aclanthology.org/2023.rocling-1.25/)). In the same paper the untuned model's outputs were recognisable as Chinese characters but semantically empty — for the Hokkien line 「大海毋驚大水」 it emitted 「大害不怕大罪」, and for 「大鑼大鼓」 it emitted 「豆河老豆河公」; the authors note only one of three sample lines came out as a meaningful sentence before fine-tuning. That is the observed failure mode: fluent-looking Chinese that sounds like the input and says something else.

For an order extractor this is the worst possible failure mode, because the output is *plausible*. A garbled transcript that still contains `C1` and `2` would be parsed into a real order.

### 2.4 Do any of these cover Southern Min as distinct from Mandarin?

The benchmarks do; the commercial APIs do not.

- **Distinct** — MinSpeech is explicitly "a speech corpus of Southern Min (also known as Hokkien)" with its own acoustic models, 20.21% CER ([Interspeech 2024](https://www.isca-archive.org/interspeech_2024/lin24m_interspeech.pdf)).
- **Distinct** — Breeze Taigi treats Taigi as its own language, scoring 30.13% CER with a Taigi-specific model versus 49.99% for the same Whisper backbone tuned for Taiwanese *Mandarin* ([arXiv:2603.19259](https://arxiv.org/abs/2603.19259)).
- **Distinct** — TaigiSpeech is "the first Taiwanese Hokkien dataset specifically designed for" spoken intent, noting that Hokkien "is a low-resource and primarily spoken language", and that many languages "are not supported by commercial AI services" ([arXiv:2603.21478](https://arxiv.org/abs/2603.21478)).
- **Not distinct** — every provider locale named `zh-TW`, `cmn-Hant-TW`, or `zh-Hant` denotes Mandarin, per the provider tables in §2.1.

### 2.5 Kuching Hokkien specifically

Kuching Hokkien is not merely an untested variety; there is published linguistic evidence that it has diverged phonologically from the Taiwan/Fujian norms the models above are trained on. A 2025 NTNU MA thesis on Kuching Hokkien found that the /-k/ stop coda is shifting to a glottal stop [-ʔ], with **47.06%** of /-k/ codas perceived as [-ʔ] and the change more advanced among younger speakers; it attributes this to contact with Hakka, Mandarin education policy, and family-language shift ([Airiti / NTNU, DOI 10.6345/NTNU202500142](https://www.airitilibrary.com/Article/Detail/U0021-NTNU46662)). The same abstract notes Hokkien serves as Kuching's Chinese lingua franca while most of the community is Hakka-speaking, so many speakers are not native Hokkien speakers.

Two consequences, and I separate them because only the first is evidenced:

- **Evidenced:** a system trained on Taiwanese Hokkien would face coda neutralisation in exactly the segment where Kuching speech differs most. The 30% CER figures in §2.2 do not transfer to Kuching.
- **Speculative — flagged as such:** Kuching Hokkien hawker speech likely also carries Malay and English loanwords for packaging goods, as Penang Hokkien does ("with extensive use of Malay and English loanwords", [Wikipedia: Penang Hokkien](https://en.wikipedia.org/wiki/Penang_Hokkien)). I found no lexical study of Kuching Hokkien trade vocabulary. Do not treat this as established.

---

## 3. Can Whisper be biased toward a known phrase list?

Short answer: **yes, partially — and not enough to rescue open transcription.** Prompting biases the decoder toward terms it might otherwise miss; it cannot add acoustic knowledge of a language the encoder was never trained on.

| Mechanism | Provider | Limit / behaviour | Source |
| :--- | :--- | :--- | :--- |
| `prompt` (initial prompt) | `whisper-1` | **224-token** limit; OpenAI explicitly says it provides "less control than the recommended transcription model" | [Speech-to-text § Prompting](https://developers.openai.com/api/docs/guides/speech-to-text#prompting) |
| `prompt` + `keywords` + `languages` | `gpt-transcribe` | Free-form context prompt plus a `keywords` list of "literal terms that may appear in the audio, such as product names". Keywords are "hints, not required output" | [Transcription § Improve transcription quality](https://developers.openai.com/api/docs/guides/transcription) |
| `PhraseSet` + `boost` | Google Cloud STT | Phrases can be single words or multi-word, with tunable boost; class tokens like `$ADDRESSNUM` can be embedded in phrases | [Model adaptation](https://cloud.google.com/speech-to-text/docs/adaptation-model) |
| Phrase list / custom speech | Azure | `zh-TW` and `ms-MY` both support phrase lists; `ms-MY` supports only "Plain text" adaptation while `zh-CN`/`zh-TW` support labelled audio, structured text and output-format adaptation | [Language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt) |
| Keyterm prompting | ElevenLabs Scribe | Keyterm list biases transcription toward supplied terms | [Keyterm prompting](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting) |
| Keyterm prompting | Deepgram | Keyterm list, up to a documented cap | [Keyterm prompting](https://developers.deepgram.com/docs/keyterm) |
| Keyterms / word boost | AssemblyAI | Keyterms prompting up to **100 words** on Universal-3.5 Pro Streaming | [Models](https://www.assemblyai.com/docs/getting-started/models) |

**The measured effect of biasing is real but modest, and it can backfire.** CB-Whisper, a peer-reviewed contextual-biasing system for Whisper, reports that adding a prompt raised named-entity recall from **8.4% to 71.8%** on the Aishell hot-word subset and by 10–20 percentage points on other sets — yet the same paper reports that the modified error rate "was less improved or even degraded" on two internal sets, because Whisper "tended to omit filler words and disfluencies if the prompt was in a well-formatted text form" ([LREC-COLING 2024](https://aclanthology.org/2024.lrec-main.262/)). The paper's conclusion is that "the prompt should include the entity words in a style that matches the usage scenario."

Applied here: hotword biasing is a recognized technique for exactly the `A1`/`C1`/`650ml` vocabulary problem, and it is worth using. But it operates on the *decoder's choice among tokens the encoder can already distinguish.* With 96.6% CER on the input, the encoder is not distinguishing Hokkien phonemes; there is nothing reliable for the prompt to select from. **Prompting is a polish on a working recognizer, not a substitute for one.**

A second, harder constraint: OpenAI's own guidance is to "track errors that matter to the application instead of relying only on word error rate" and to test "names, numbers, dates, alphanumeric strings" ([Transcription § Test with representative audio](https://developers.openai.com/api/docs/guides/transcription)). For Sarpply the metric that matters is **not** WER — it is *SKU-code accuracy* and *quantity accuracy*, per line item. Those are harsher than WER, because a single wrong digit is a full line-item error regardless of how much surrounding text was right.

---

## 4. Sarawak Malay vs standard Malay (`ms-MY`)

### 4.1 Does it differ enough to matter?

**Yes — measurably, on the dimensions ASR is sensitive to.** `ms-MY` and `ms` select standard Malay; Sarawak Malay is a distinct regional variety.

| Dimension | Evidence |
| :--- | :--- |
| **Recognised as a separate variety** | Sarawak Malay has its own description and is divided into three dialects, including "the Kuching dialect spoken in Kuching and Kota Samarahan" ([Wikipedia: Sarawak Malay](https://en.wikipedia.org/wiki/Sarawak_Malay)) — i.e. the exact beachhead locality for this project |
| **Vowel distribution differs** | "Sarawak Malay has the same vowel inventory as Standard Malay … However, the distribution of these vowels is a little different." Word-final ⟨a⟩ is /a/ in the Kuching dialect but /o/ in the Saribas dialect — *ada* is /ada/ vs /ado/ ([Wikipedia: Sarawak Malay](https://en.wikipedia.org/wiki/Sarawak_Malay)) |
| **Consonant inventory / phoneme count** | 19 consonantal phonemes, with the regional pronunciation of Kuching itself recorded as "Kuchin" in older maps "reflecting the regional pronunciation of the city name" ([Wikipedia: Sarawak Malay](https://en.wikipedia.org/wiki/Sarawak_Malay)) |
| **Morphology is reduced** | A table of Standard Malay ↔ Sarawak Malay verb correspondences shows Sarawak Malay dropping the *meN-* prefix: *memutus*→*putus*, *membeli*→*beli*, *menolak*→*tolak*, *mendengar*→*dengar* ([Wikipedia: Sarawak Malay](https://en.wikipedia.org/wiki/Sarawak_Malay)) |
| **Lexical false friends** | "Sarawak Malay has a rich vocabulary of which many words, while also found in Standard Malay, have completely different meanings" — e.g. *agak* = 'to meet' (SM: 'to guess'), *kelakar* = 'to talk' (SM: 'funny'), *tangga* = 'to look' (SM: 'stairs') ([Wikipedia: Sarawak Malay](https://en.wikipedia.org/wiki/Sarawak_Malay)) |
| **Recognised as low-resource for ASR** | UNIMAS publishes a Sarawak Malay ASR corpus described as "a low-resource dialect spoken in Sarawak, Malaysia": 1,164 utterances, ~1.9 h audio, 42 speakers, 2,329 unique words ([HuggingFace: SaLTUNIMAS/sarawak-malay-asr](https://huggingface.co/datasets/SaLTUNIMAS/sarawak-malay-asr)) |

The lexical false-friend row is the one that most directly threatens an order parser: a word the system reads as standard Malay may mean something unrelated in Sarawak Malay. The corpus row is the one that most directly threatens feasibility: ~1.9 hours is not enough to train a recognizer, and it is the only Sarawak Malay ASR corpus I could locate.

### 4.2 What the accuracy literature says

Tan, Qin, Juan and Khaw (2024) model low-resource Malay dialects by transfer learning from a standard Malay ASR model, covering **Kelantan Malay and Sarawak Malay**, and report "an average word error rate (WER) of 68.2% and 69.4%, respectively", with Table 7 for Kelantan and Table 8 for Sarawak ([Pertanika J. Sci. & Technol. 32(4)](https://doi.org/10.47836/pjst.32.4.06)).

**Caveat on this citation, stated plainly.** The Pertanika PDF host timed out on every attempt; I could not retrieve the full text. The two WER values are confirmed verbatim from an indexing snippet of the paper, but **which of 68.2% / 69.4% belongs to Sarawak Malay is inferred from the sentence order**, not confirmed against Table 8. Treat "≈69%" as the Sarawak Malay figure with that uncertainty attached, and verify against the PDF before quoting it in a business case. The load-bearing claim — that dialect transfer from standard Malay leaves error rates in the high sixties — holds either way.

### 4.3 Bearing on this pipeline

Standard Malay ASR is *available* (`ms-MY`, `ms` at every provider in §2.1) and, on standard Malay, respectable: ElevenLabs buckets Malay (`msa`) at ≤5% WER, its top tier ([Speech to text](https://elevenlabs.io/docs/capabilities/speech-to-text)); AssemblyAI buckets Malay in "Good accuracy (>10% to ≤25% WER)" ([Supported languages](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/supported-languages)). Those are standard-Malay figures and should not be projected onto Sarawak Malay.

So Sarawak Malay sits in a materially better position than Hokkien — the script is Latin, the language is written, `ms` is universally supported, and a ~69% WER baseline from transfer learning is a documented starting point rather than a blank page. It is still not good enough to extract quantities unreviewed. A 69% WER on a five-word order means the quantity is frequently wrong.

---

## 5. Alternative: constrained-vocabulary / keyword-spotting classification

### 5.1 Does the approach have precedent?

**Yes, and the precedent is directly on point for Hokkien.**

| Precedent | What it shows | Source |
| :--- | :--- | :--- |
| **TaigiSpeech** — 3,079 utterances, 21 elderly speakers, **8 intent classes** (e.g. `PAIN_GENERAL`, `CALL_CONTACT`, `LIGHT_ON`, `LIGHT_OFF`, `CANCEL`) | A purpose-built Taiwanese Hokkien *spoken intent* dataset, i.e. exactly the "closed set of ~10–20 phrases plus digits" shape proposed here, for a domain where the stakes are high and the vocabulary is fixed | [arXiv:2603.21478](https://arxiv.org/abs/2603.21478) |
| **TaigiSpeech end-to-end classification results** | HuBERT Base **90.10%**, WavLM Base **88.96%**, WavLM Base+ **90.21%** intent accuracy — versus a Whisper+LLM cascade at **15.00%–42.92%** and Qwen3-ASR+LLM at **63.65%–74.48%** | [arXiv:2603.21478](https://arxiv.org/abs/2603.21478) |
| **Fluent Speech Commands** | The canonical limited-domain SLU benchmark: map speech directly to intent+slot (action/object/location) rather than via text; motivated by the difficulty of end-to-end SLU "without a large amount of training data" | [arXiv:1904.03670](https://arxiv.org/abs/1904.03670) |
| **Keyword spotting inside ASR** | CB-Whisper trains a small CNN keyword-spotter over Whisper encoder features and gets "recall of more than 0.8 and precision of over 0.5" on out-of-vocabulary technical terms — including on a dataset in a *different language* from the training set | [LREC-COLING 2024](https://aclanthology.org/2024.lrec-main.262/) |

**The single most important number in this document is the 90.21% vs 34.38% gap.** On the same Taiwanese Hokkien data, an end-to-end classifier over 8 intents scored ~90%, while the *best cascade* (Whisper large-v3 + Qwen3-8B) scored 34.38% and Whisper medium scored 42.92%. Bypassing text generation more than doubles accuracy. That is the empirical case for a constrained classifier over a transcription pipeline, on Hokkien, published.

### 5.2 What the precedent also shows — and it constrains the recommendation

- **~90% is not 100%, and intent accuracy ≠ order correctness.** TaigiSpeech's ~90% is over 8 mutually distinct intents. Sarpply needs 6 SKUs × an unbounded quantity; a 10% intent error rate on a money-committing order is a real operational cost.
- **Someone had to collect the data.** TaigiSpeech's ~90% comes from models trained on 3,079 utterances of *Taiwanese* Hokkien from 21 speakers. Kuching Hokkien is a different variety (§2.5). The method transfers; the weights do not.
- **The commercial fallback is the weak end.** Qwen3-ASR (a foundation model with some Southern Min ability) reached 63.65–74.48% in the cascade — better than Whisper but short of a trained classifier, and these are *untaught* foundation models on a *related* variety.

### 5.3 What a Kuching build would actually require

Flagged **speculative/planning** — no published source sizes this, so these are engineering inferences from the precedents above:

1. **A small recorded corpus in Kuching Hokkien.** TaigiSpeech managed 3,079 utterances from 21 speakers for 8 intents. A comparable order for Sarpply is ~15–20 phrases + digits × several speakers × several repetitions. This is a field-data collection task in Kuching kopitiams, not an API integration. It is also the only asset in this plan with a defensible moat.
2. **Classification, not transcription.** Train over a fixed label set (6 SKUs + `needs_clarification` + digits 1–10), on features from a self-supervised backbone, per the HuBERT/WavLM result.
3. **Digits are their own problem.** Quantity is the second half of every order and numerals are the highest-risk tokens. `satu`/`dua`/`tiga` in Sarawak Malay and Hokkien numerals for 1–10 need to be separately validated, not folded into SKU classification.
4. **A confirmation echo, not a transcript.** Per ADR-0012's receipt-echo principle, the system should read the parsed order back for confirmation rather than write the voice note into prose — the pipeline's output is a decision, not a transcript.

### 5.4 Where the biasing tools still help

If any transcription component is retained (e.g. as a Tier-2 fallback on the Sarawak Malay path), the phrase-list mechanisms in §3 are the right tool and should be configured with the full Golden 6 synonym lists from TRD §2.2 — in Latin script for Malay and, where applicable, Han characters for Mandarin. Note the Azure asymmetry found in §3: `ms-MY` supports phrase lists only as plain text, while `zh-CN`/`zh-TW` support labelled-audio custom speech. Any plan to fine-tune on a Stall-recorded corpus therefore exists for Mandarin, and not for Malay, on Azure.

---

## 6. Recommendation

**1. Do not build an open-transcription pipeline for Kuching Hokkien. There is no provider that handles it.**
No commercial ASR service in §2.1 accepts a Southern Min language code; the `zh-TW` / `cmn-Hant-TW` codes that look closest all select Taiwanese Mandarin. The only published zero-shot measurement is 96.6% CER for Whisper on Hokkien (§2.2) — a failure mode that produces plausible-looking Chinese containing the wrong SKU. Building the voice path on open transcription would ship a parser that confidently extracts wrong orders.

**2. Keep Hokkien voice notes as an input the system *accepts but does not auto-commit*.** This preserves ADR-0004's core commitment — a hawker never has to type or learn a form — without betting the carton purchase on a 96.6%-CER transcript. The concrete shape:

- **Tier 0 (MVP, no ASR):** the voice note is retained and surfaced to the Founder for manual transcription into `A1 x 3` syntax, which the existing Tier-1 regex then handles. This is exactly what Phase 1 already does by hand, and it costs nothing to keep doing.
- **Tier 1 (constrained classifier):** a purpose-trained 6-SKU + digit classifier over a Kuching-Hokkien corpus (§5.3), gated behind a confidence threshold. Below threshold → Tier 0. TaigiSpeech's ~90% intent accuracy is the realistic ceiling to plan against, and it is measured on a *different* Hokkien variety.
- **Tier 2 (LLM parse):** unchanged from TRD §2.2, operating on whatever text is available.

**3. Treat Sarawak Malay as the tractable half, and standard Malay as a baseline rather than a solution.** `ms`/`ms-MY` is supported at every provider and scores well on standard Malay (ElevenLabs ≤5% WER tier; AssemblyAI 10–25% band). But Sarawak Malay differs in vowel distribution, morphology, and — most dangerously for a parser — lexically, with words that carry unrelated meanings (§4.1), and dialect-transfer research reports ~69% WER on it (§4.2). Route Sarawak Malay through ASR **with a mandatory read-back confirmation**, never a silent commit. Note the ~69% figure's dialect mapping is inferred, not read off Table 8; verify before external use.

**4. Rework the schema's `preferred_language` enum before Phase 2.** `docs/02_product_eng/09_Backend_Schema.md` currently admits `'nan-TW-kuching-hokkien'`. No ASR provider accepts that string — it is not an ISO code, and the nearest ISO forms (`nan`, `nan-TW`) are absent from every provider's accepted list in §2.1. It should either be marked as an *internal Sarpply label* not passed to any ASR vendor, or replaced with a value the pipeline can actually act on. **This is the one place where this research contradicts an existing schema decision, and it should be fixed regardless of which ASR path is chosen.** (Recorded here rather than edited, per this task's instruction not to modify other files.)

### 6.1 Risk, stated plainly

If Sarpply launches voice ordering for Kuching Hokkien on any provider in §2.1, **the system will transcribe Hokkien audio as Mandarin and return confident, wrong orders.** The failure is not loud. It looks like a plausible Chinese transcript containing a real SKU code and a real number, which the regex parser will accept. Downstream that becomes a wrong Master Carton purchase (ADR-0002 freezes Ordered Bundles at Cutoff, so the error is not self-correcting), a wrong delivery, and a Stall that has been charged for the wrong goods.

The mitigation is architectural, not a better model: **never let an unverified transcript commit an order.** Confidence-gated classification, a read-back confirmation, or manual transcription for the Hokkien path — one of those three must sit between the voice note and the PO.

### 6.2 What would change this answer

- **A Kuching Hokkien ASR corpus and a trained model.** 3,000+ utterances would make §5.3 viable. Nothing on the market substitutes for it.
- **A provider shipping a Southern Min code with a published accuracy contract.** As of 2026-10-27, none does.
- **A measured Kuching Hokkien CER on a fine-tuned model** — the Taigi fine-tuning result (50.7% CER from 800 h) suggests the ceiling for a well-resourced effort, and that is still not order-grade accuracy.

**Unverified assumption to test before building anything:** that Stalls actually send voice notes at meaningful rates, and in which language. ADR-0004 asserts the need; no measured figure exists in this repo. If voice volume is low and mostly Mandarin, the entire Hokkien problem may be deferrable — and Mandarin is well served everywhere.

---

## 7. Sources

Provider documentation
- OpenAI, Whisper language table — https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
- OpenAI, Speech to text (supported languages, prompting, 224-token limit) — https://developers.openai.com/api/docs/guides/speech-to-text
- OpenAI, Transcription (prompt/keywords/languages, deprecations, evaluation guidance) — https://developers.openai.com/api/docs/guides/transcription
- Google Cloud, Speech-to-Text supported languages — https://cloud.google.com/speech-to-text/docs/supported-languages
- Google Cloud, Model adaptation / PhraseSet / boost — https://cloud.google.com/speech-to-text/docs/adaptation-model
- Microsoft Azure, Speech language support (`ms-MY`, `zh-TW`, `yue-CN`, `wuu-CN`, custom-speech capabilities) — https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt
- ElevenLabs, Speech to text (90+ languages, per-language WER buckets) — https://elevenlabs.io/docs/capabilities/speech-to-text
- ElevenLabs, Keyterm prompting — https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting
- Deepgram, Models & languages — https://developers.deepgram.com/docs/models-languages-overview
- Deepgram, Keyterm prompting — https://developers.deepgram.com/docs/keyterm
- AssemblyAI, Supported languages (Universal-2 WER bands, U3.5 Pro 18 langs) — https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/supported-languages
- AssemblyAI, Models (keyterms up to 100 words) — https://www.assemblyai.com/docs/getting-started/models

Hokkien / Southern Min accuracy literature
- Hsieh, Lyu & Lyu (2023), *Taiwanese/Mandarin Speech Recognition using OpenAI's Whisper…*, ROCLING 2023 — https://aclanthology.org/2023.rocling-1.25/ (96.6% zero-shot CER; 50.7% fine-tuned)
- Lan et al. (2026), *Breeze Taigi: Benchmarks and Models for Taiwanese Hokkien Speech Recognition and Synthesis*, arXiv:2603.19259 — https://arxiv.org/abs/2603.19259 (30.13% BreezeASR-Taigi; 32.11% Yating; 49.99% ASR25)
- Lin et al. (2024), *MinSpeech: A Corpus of Southern Min Dialect for ASR*, Interspeech 2024 — https://www.isca-archive.org/interspeech_2024/lin24m_interspeech.pdf (20.21% CER HuBERT-large; 1,778 h labelled)
- (2026), *TaigiSpeech: Taiwanese Hokkien spoken intent dataset*, arXiv:2603.21478 — https://arxiv.org/abs/2603.21478 (8 intents; 90.21% WavLM vs 34.38% Whisper large-v3 cascade)
- Radford et al. (2022), *Robust Speech Recognition via Large-Scale Weak Supervision*, arXiv:2212.04356 — https://arxiv.org/abs/2212.04356
- Chou et al., Breeze ASR 25 (Whisper-large-v2 tuned for Taiwanese Mandarin) — cited via Breeze Taigi above

Malay / Sarawak Malay
- Tan, Qin, Juan & Khaw (2024), *Low Resource Malay Dialect Automatic Speech Recognition Modeling Using Transfer Learning from a Standard Malay Model*, Pertanika J. Sci. & Technol. 32(4) — https://doi.org/10.47836/pjst.32.4.06 (68.2% / 69.4% WER; full text not retrievable)
- UNIMAS, Sarawak Malay ASR corpus — https://huggingface.co/datasets/SaLTUNIMAS/sarawak-malay-asr (1,164 utts, ~1.9 h, 42 speakers)
- Sarawak Malay (phonology, morphology, vocabulary) — https://en.wikipedia.org/wiki/Sarawak_Malay
- Hokkien (geographic spread incl. Kuching) — https://en.wikipedia.org/wiki/Hokkien
- Penang Hokkien (Malay/English loanwords) — https://en.wikipedia.org/wiki/Penang_Hokkien

Kuching Hokkien
- Goh Chen-Yang (2025), *Sound Change in Kuching Hokkien Stop Codas*, NTNU MA thesis, DOI 10.6345/NTNU202500142 — https://www.airitilibrary.com/Article/Detail/U0021-NTNU46662 (47.06% of /-k/ perceived as [-ʔ]; Hakka contact; non-native-speaker majority)

Constrained-vocabulary / limited-domain ASR precedent
- Lugosch et al. (2019), *Speech Model Pre-training for End-to-End Spoken Language Understanding* (Fluent Speech Commands), arXiv:1904.03670 — https://arxiv.org/abs/1904.03670
- Chen et al. (2024), *CB-Whisper: Contextual Biasing Whisper using Open-Vocabulary Keyword-Spotting*, LREC-COLING 2024 — https://aclanthology.org/2024.lrec-main.262/ (entity recall 8.4%→71.8%; MER degradation on 2 of 5 sets)

Operational risk, limited-domain order-taking
- Restaurant Dive (2025-10-02), Intouch Insight QSR drive-thru report — https://www.restaurantdive.com/news/intouch-insight-drive-thru-ai-speed-satisfaction-taco-bell-chick-fil-a/801721/ (AI orders: 34% repeat rate vs 22% average; order accuracy 87%→83%)
- Hi Auto, *ASR in Drive-Thru AI* (vendor claim, not independent) — https://hi.auto/blog/what-is-automatic-speech-recognition-drive-thru (93%+ completion, 96% accuracy across ~1,000 stores)

Internal
- ADR-0004 (orders by free text and voice) — `docs/adr/0004-orders-by-free-text-and-voice.md`
- ADR-0002 (Ordered Bundles frozen at Cutoff) — `docs/adr/0002-ordered-bundles-frozen-at-cutoff.md`
- ADR-0012 (Runner least privilege and receipt echo) — `docs/adr/0012-runner-least-privilege-and-receipt-echo.md`
- PRD §4 Golden 6 catalogue; FR-2.3 trilingual NLP fallback — `docs/02_product_eng/05_PRD.md`
- TRD §2.2 Tier-2 synonym dictionary — `docs/02_product_eng/06_TRD.md`
- `preferred_language` enum — `docs/02_product_eng/09_Backend_Schema.md`

## 8. Open items

1. **Verify §4.2's dialect mapping** against Pertanika Table 8 (PDF host was unreachable during this research).
2. **Measure voice-note rate and language mix** on the Phase 1 WhatsApp channel before committing to any ASR build (§6.2).
3. **Confirm Yating's API terms** — it is the only commercial Taiwanese Hokkien engine found (§2.1), but its language codes and accuracy contract are unpublished; whether it will accept Sarawakian Hokkien is unknown and untested.
4. **Resolve the `preferred_language` value** in the backend schema (§6, item 4).
