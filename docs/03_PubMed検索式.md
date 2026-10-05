# PubMed 検索式（Step 2〜4用）

> 使い方：各ブロックをそのまま PubMed の検索窓にコピペする。
> まず **①広め** で件数を見て、多すぎたら **②絞り込み** を使う（目安：精読候補を探すなら100件以下）。

## 0. 検索式の基本（初学者向け）

| 記号 | 意味 |
|---|---|
| `[Mesh]` | MeSH（PubMedの統制語）で検索。同義語もまとめて拾ってくれる。ただし**最新論文はまだMeSHが付いていない**ことがある |
| `[tiab]` | タイトル（title）・抄録（abstract）に含まれる語で検索。最新論文を拾える |
| `*` | 前方一致。`pharmacoepidemiolog*` → pharmacoepidemiology / pharmacoepidemiological |
| `"..."` | フレーズ検索 |
| `AND` / `OR` / `NOT` | 大文字で書く。`OR` は括弧でまとめる |

**基本の型**：`（対象集団）AND（薬剤・曝露）AND（アウトカム）AND（日本 or DB研究）`

**便利な機能**
- 左側の **Publication date → 5 years** で直近5年に絞り込める。
- 良い論文が見つかったら、**Similar articles** と **Cited by** から芋づる式にたどる。最新の関連研究はここで見つかることが多い。
- **Advanced → History** で、検索した件数を記録しておく（面談で「何件中何件を読んだ」と言える）。

---

## 共通パーツ（コピペ用）

**[DB] レセプト・データベース研究**
```
("Administrative Claims, Healthcare"[Mesh] OR "Databases, Factual"[Mesh] OR claims[tiab] OR "claims database"[tiab] OR "administrative data"[tiab] OR "real-world"[tiab] OR JMDC[tiab] OR DeSC[tiab] OR "Medical Data Vision"[tiab] OR MDV[tiab] OR "National Database"[tiab] OR NDB[tiab])
```

**[JP] 日本**
```
("Japan"[Mesh] OR Japan*[tiab])
```

---

## 案A：抗がん薬・骨修飾薬と顎骨壊死（MRONJ）

**① 広め：日本のDB研究**
```
("Bisphosphonate-Associated Osteonecrosis of the Jaw"[Mesh] OR "osteonecrosis of the jaw"[tiab] OR MRONJ[tiab] OR ARONJ[tiab] OR BRONJ[tiab])
AND ("Administrative Claims, Healthcare"[Mesh] OR "Databases, Factual"[Mesh] OR claims[tiab] OR "real-world"[tiab] OR JMDC[tiab] OR DeSC[tiab] OR NDB[tiab] OR "National Database"[tiab] OR Kokuho[tiab])
AND ("Japan"[Mesh] OR Japan*[tiab])
```

**② 絞り込み：がん患者 × 併用抗がん薬（世界全体）**
```
("osteonecrosis of the jaw"[tiab] OR MRONJ[tiab])
AND ("Neoplasms"[Mesh] OR cancer[tiab] OR "bone metastas*"[tiab] OR myeloma[tiab])
AND ("Angiogenesis Inhibitors"[Mesh] OR bevacizumab[tiab] OR sunitinib[tiab] OR "tyrosine kinase inhibitor*"[tiab] OR "mTOR inhibitor*"[tiab] OR everolimus[tiab] OR "immune checkpoint inhibitor*"[tiab] OR "Glucocorticoids"[Mesh] OR corticosteroid*[tiab])
AND ("risk factor*"[tiab] OR cohort[tiab] OR "Risk Factors"[Mesh])
```

**③ 副作用報告DB（JADER/FAERS）でのシグナル**（「仮説の出どころ」を確認するため）
```
("osteonecrosis of the jaw"[tiab] OR MRONJ[tiab]) AND (JADER[tiab] OR FAERS[tiab] OR "spontaneous report*"[tiab] OR pharmacovigilance[tiab] OR disproportionality[tiab])
```

---

## 案B：化学療法と早発卵巣不全（POI）・GnRHアゴニスト

**① 広め：化学療法による卵巣機能不全のリスク因子**
```
("Primary Ovarian Insufficiency"[Mesh] OR "premature ovarian insufficiency"[tiab] OR "premature ovarian failure"[tiab] OR "chemotherapy-induced amenorrhea"[tiab] OR "ovarian toxicity"[tiab] OR gonadotoxic*[tiab])
AND ("Antineoplastic Agents"[Mesh] OR chemotherapy[tiab] OR "Antineoplastic Agents, Alkylating"[Mesh] OR cyclophosphamide[tiab] OR "cyclophosphamide equivalent dose"[tiab])
AND ("risk factor*"[tiab] OR cohort[tiab] OR "Risk Factors"[Mesh])
```

**② 絞り込み：DB研究に限定**
```
("Primary Ovarian Insufficiency"[Mesh] OR "premature ovarian insufficiency"[tiab] OR "ovarian failure"[tiab] OR "Fertility Preservation"[Mesh] OR "fertility preservation"[tiab] OR infertility[tiab])
AND ("Neoplasms"[Mesh] OR cancer[tiab])
AND ("Administrative Claims, Healthcare"[Mesh] OR claims[tiab] OR "population-based"[tiab] OR registry[tiab] OR JMDC[tiab])
```

**③ GnRHアゴニストによる卵巣保護**
```
("Gonadotropin-Releasing Hormone/agonists"[Mesh] OR "GnRH agonist*"[tiab] OR "LHRH agonist*"[tiab] OR goserelin[tiab] OR leuprorelin[tiab] OR leuprolide[tiab])
AND (chemotherapy[tiab] OR "Antineoplastic Agents"[Mesh])
AND ("ovarian protection"[tiab] OR "ovarian function"[tiab] OR "Primary Ovarian Insufficiency"[Mesh] OR "premature ovarian insufficiency"[tiab])
```
→ メタ解析だけを見たいときは、末尾に `AND (meta-analysis[pt] OR "systematic review"[pt])` を足す。

**④ 小児がん経験者の生殖機能（B6 山本さんのテーマとの切り分け用）**
```
("Cancer Survivors"[Mesh] OR survivor*[tiab]) AND (child*[tiab] OR pediatric[tiab] OR adolescent*[tiab] OR "young adult*"[tiab] OR AYA[tiab])
AND ("Infertility"[Mesh] OR "Primary Ovarian Insufficiency"[Mesh] OR hypogonadism[tiab] OR "gonadal dysfunction"[tiab] OR fertility[tiab])
AND ("Japan"[Mesh] OR Japan*[tiab])
```

---

## 案C：抗がん薬の避妊期間と治療後の妊娠

**① 抗がん薬治療後の妊娠・避妊**
```
("Antineoplastic Agents"[Mesh] OR chemotherapy[tiab] OR "anticancer drug*"[tiab])
AND ("Contraception"[Mesh] OR contracepti*[tiab] OR "washout period"[tiab] OR "pregnancy after"[tiab] OR "time to pregnancy"[tiab] OR "Pregnancy Rate"[Mesh])
AND ("Neoplasms"[Mesh] OR cancer[tiab])
```

**② 母子紐付けDB（周産期の薬剤疫学の方法論）**
```
("mother-infant"[tiab] OR "mother-child"[tiab] OR "maternal-infant"[tiab] OR "mother-baby"[tiab]) AND (linkage[tiab] OR linked[tiab])
AND (claims[tiab] OR "Administrative Claims, Healthcare"[Mesh] OR JMDC[tiab] OR DeSC[tiab])
AND ("Japan"[Mesh] OR Japan*[tiab])
```

**③ 日本語文献（医中誌が使えるなら医中誌のほうが良い）**
- 医中誌Webで：`抗悪性腫瘍剤 AND 避妊 AND 添付文書`

---

## 案D：妊娠期がんと母体・児のアウトカム

```
("Pregnancy Complications, Neoplastic"[Mesh] OR "pregnancy-associated cancer"[tiab] OR "cancer during pregnancy"[tiab] OR "cancer in pregnancy"[tiab] OR "gestational cancer"[tiab])
AND ("Antineoplastic Agents"[Mesh] OR chemotherapy[tiab])
AND ("Pregnancy Outcome"[Mesh] OR "Premature Birth"[Mesh] OR "Infant, Low Birth Weight"[Mesh] OR "neonatal outcome*"[tiab] OR "Prenatal Exposure Delayed Effects"[Mesh])
```
→ 日本に絞るなら `AND ("Japan"[Mesh] OR Japan*[tiab])` を追加。

---

## 案E：酸分泌抑制薬と経口抗がん薬の相互作用

```
("Proton Pump Inhibitors"[Mesh] OR "proton pump inhibitor*"[tiab] OR vonoprazan[tiab] OR "acid-reducing agent*"[tiab] OR "acid suppress*"[tiab])
AND (capecitabine[tiab] OR "Protein Kinase Inhibitors"[Mesh] OR "tyrosine kinase inhibitor*"[tiab] OR palbociclib[tiab] OR abemaciclib[tiab] OR "CDK4/6"[tiab])
AND ("Drug Interactions"[Mesh] OR interaction*[tiab] OR survival[tiab] OR "time to treatment discontinuation"[tiab])
```

---

## Step 2で挙げた論文をピンポイントで探す

| 論文 | PubMedに入れるもの |
|---|---|
| 静岡国保DB 顎骨壊死 | `42372806` |
| Ishimaru NDB 顎骨壊死 | `Ishimaru M[Author] AND "osteonecrosis of the jaw"[tiab]` |
| JMDC パクリタキセル後の心不全 | `41970488` |
| Hatakeyama 周産期DB適合性 | `41224242` |
| JMDC 母子紐付けの評価 | `38313043` |
| JMDC 生殖年齢乳がん女性の処方 | `"Real-World Anticancer Medications for Reproductive-Age Women with Breast Cancer"` |
| トラスツズマブ中止と心機能 | `39754790` |

---

## Step 4用：土屋先生の論文

PubMedは著者名を「姓＋名のイニシャル」で登録しているので、**フルネーム（名のイニシャル）を確認**してから検索する。
```
Tsuchiya ?[Author] AND (Keio[Affiliation] OR "Keio University"[Affiliation])
```
- `?` に名のイニシャルを入れる（例：名が「M」で始まるなら `Tsuchiya M[Author]`）。
- 慶應に移る前の所属の論文も拾いたい場合は、所属の条件を外して、テーマで絞る：
```
Tsuchiya ?[Author] AND (antiemetic*[tiab] OR "Antiemetics"[Mesh] OR nausea[tiab] OR chemotherapy[tiab] OR fertility[tiab] OR claims[tiab])
```
- 同姓の別人が混ざりやすいので、研究室のWebページや researchmap の業績一覧と照らし合わせる。

---

## 追加：ICIの軸（テーマ①・②）

**共通パーツ [ICI]**
```
("Immune Checkpoint Inhibitors"[Mesh] OR "immune checkpoint inhibitor*"[tiab] OR nivolumab[tiab] OR pembrolizumab[tiab] OR ipilimumab[tiab] OR atezolizumab[tiab] OR durvalumab[tiab] OR "anti-PD-1"[tiab] OR "anti-PD-L1"[tiab])
```

**① ICIと生殖機能・妊孕性**
```
("Immune Checkpoint Inhibitors"[Mesh] OR "immune checkpoint inhibitor*"[tiab] OR nivolumab[tiab] OR pembrolizumab[tiab] OR ipilimumab[tiab])
AND (fertility[tiab] OR infertility[tiab] OR "ovarian function"[tiab] OR "ovarian reserve"[tiab] OR "anti-Mullerian hormone"[tiab] OR AMH[tiab] OR hypogonadism[tiab] OR orchitis[tiab] OR "testicular function"[tiab] OR spermatogenesis[tiab] OR pregnancy[tiab])
```

**①-補足 内分泌irAEの日本のDB研究（アウトカム定義の参考）**
```
("immune checkpoint inhibitor*"[tiab] OR nivolumab[tiab] OR pembrolizumab[tiab])
AND (hypothyroidism[tiab] OR "adrenal insufficiency"[tiab] OR hypophysitis[tiab] OR "type 1 diabetes"[tiab] OR endocrin*[tiab])
AND (claims[tiab] OR JMDC[tiab] OR DeSC[tiab] OR "Administrative Claims, Healthcare"[Mesh] OR JADER[tiab])
AND ("Japan"[Mesh] OR Japan*[tiab])
```

**② 自己免疫疾患の既往とirAE**
```
("Immune Checkpoint Inhibitors"[Mesh] OR "immune checkpoint inhibitor*"[tiab] OR nivolumab[tiab] OR pembrolizumab[tiab])
AND ("Autoimmune Diseases"[Mesh] OR "pre-existing autoimmune"[tiab] OR "preexisting autoimmune"[tiab] OR "autoimmune disease*"[tiab] OR "rheumatoid arthritis"[tiab] OR psoriasis[tiab] OR "inflammatory bowel disease"[tiab])
AND ("immune-related adverse event*"[tiab] OR irAE*[tiab] OR flare*[tiab])
```
→ DB研究に絞るなら `AND (claims[tiab] OR "real-world"[tiab] OR cohort[tiab] OR registry[tiab])` を追加。

**論文のピンポイント検索**
| 論文 | PubMedに入れるもの |
|---|---|
| DeSC 内分泌irAE（JCEM 2025） | `40503677` |
| ペムブロリズマブと卵巣機能（BCRT 2025） | `40261555` |
| ICI後の精巣機能（Clin Endocrinol 2025） | `40653940` |
| ICIと女性の妊孕性 SR | `42102629` |
