# Промпты для картинок — v1 «Переживите обе революции»

Модель: **FLUX.1 dev** (не Kontext), guidance 1.8–2.0, steps 24, 1216×832 (или вертикаль под портреты).
LoRA: `ume_classic_impressionist` 0.6–0.7. Генерь по 4 штуки, выбирай лучшую.
Для настоящей фактуры — img2img от реального холста, denoising 0.5 (тогда из промпта можно убрать слова про свет).

Два суффикса стиля (подставляй в конец сцены):

- **[ТЁПЛЫЙ]** — для сцен полегче (НЭП, завод, деревня в мирный год, портреты):
  `finished figurative oil painting, solid academic drawing, clear forms, warm naturalistic light, muted warm palette, confident economical brushwork that describes form, off-center asymmetric composition, one foreground figure seen from behind, figures at different distances, nobody posing, Soviet genre painting in the manner of Sergei Grigoriev and Arkady Plastov`

- **[МРАЧНЫЙ]** — для террора, войны, голода, эвакуаций:
  `finished figurative oil painting, solid academic drawing, somber muted palette, cold overcast light, off-center asymmetric composition, one foreground figure seen from behind, figures at different distances, nobody posing, 19th century Russian realist painting of hardship in the manner of Ilya Repin and Nikolai Yaroshenko, the Peredvizhniki`

---

## Персонажи (экран выбора)

НЕ портрет крупным планом. Фигура **в полный рост, но как деталь сцены**: человек мелкий,
смещён от центра, **виден со спины или в профиль, лицо не читается**, а кто он — говорит
обстановка. Среда — главный герой кадра, человек — лишь один из его элементов. Обезличенно.
Формат лучше горизонтальный (больше среды) или 4:5.

**Рабочий Путиловского завода** [ТЁПЛЫЙ]
`A wide dim factory workshop interior dominated by lathes, drive belts and overhead line shafts, a single worker in a grimy grey shirt standing small and off-center at his machine, seen from behind, his face turned away and unseen, a shaft of dusty daylight from a high window, the machinery and the vast workshop the true subject, the man just one small detail of the scene`

**Поручик-фронтовик** [МРАЧНЫЙ]
`A bleak front-line scene, a muddy trench line under a low grey sky, a lone officer in a worn field greatcoat standing full-length, small and off-center, seen from behind, his face unseen, the desolate churned war landscape dominating the frame, the figure only an incidental detail`

**Курсистка-бестужевка** [ТЁПЛЫЙ]
`A modest room or lecture hall filled with books, papers and worn desks, a young woman student in a plain dark dress standing full-length by a tall window with her back to the viewer, face unseen, soft daylight falling across the interior, the quiet studious room the true subject, the figure a small detail`

**Фабрикант** [ТЁПЛЫЙ]
`A large factory floor seen from an office landing, a well-dressed stout man in a dark suit standing full-length with his back to the viewer, small and off-center, looking out over rows of machines and workers below, face unseen, the industrial hall dominating the frame, the owner just one figure lost in it`

---

## Основная линия

**гл.1 — Февраль 1917 (хлебные бунты)** [МРАЧНЫЙ]
`A crowd of women textile workers on strike marching down a snowy Petrograd street shouting for bread, worn shawls and coats, breath steam in the cold, mounted cossacks watching passively in the background, red banners`

**гл.2 — Отречение / красные банты (март 1917)** [ТЁПЛЫЙ]
`A jubilant Petrograd street crowd in March 1917 wearing red bows and ribbons, soldiers with red flags fraternizing with civilians, hats thrown up, thin spring sunlight, an old regime eagle being pulled down in the background`

**гл.3 — Июльские дни 1917** [МРАЧНЫЙ]
`A July 1917 armed demonstration on Nevsky Prospect scattering in panic as machine-gun fire rakes the avenue from a rooftop, workers and sailors diving for cover, a dropped banner and a fallen man on the cobbles`

**гл.4 — Октябрь 1917 (Зимний)** [МРАЧНЫЙ]
`Night, the Winter Palace, red guards and sailors flooding in through a side gate, a searchlight beam and the silhouette of the cruiser Aurora on the Neva, bayonets, cold blue darkness with warm lamplight from the windows`

**гл.4 (тюрьма) — «Кресты»** [МРАЧНЫЙ]
`A cramped prison cell in the Kresty prison, several men crowded on iron bunks, a small barred window high on the wall letting in cold grey light, a slop bucket, dim and stale`

**гл.5 — Учредительное собрание, «караул устал» (янв 1918)** [МРАЧНЫЙ]
`The night hall of the Tauride Palace half empty, a sailor with a lantern telling the last seated delegates to leave, scattered chairs and papers, cold electric light, the end of a parliament`

**гл.6 — Весна 1918 (пустеющий Петроград, куда бежать)** [МРАЧНЫЙ]
`An emptying Petrograd street in spring 1918, grass sprouting between the cobbles, shuttered dark shops, a family with bundles and a handcart standing at a crossroads deciding which way to go, thin cold light`

---

## Ветка «красный город» (Петроград / Москва)

**гл.7 — Красный террор (осень 1918)** [МРАЧНЫЙ]
`Night in a Petrograd courtyard, a covered truck with dimmed headlights, two men in leather jackets leading a prisoner out of a doorway, a frightened face at a lit window above, wet cobblestones, quiet dread`

**гл.7 — ЧК, кабинет ночью** [МРАЧНЫЙ]
`A bare Cheka office at night, a man in a worn leather jacket sitting at a paper-strewn desk writing under a single bare bulb, a holstered Mauser and a tin mug on the desk, brown and black shadows, banal weariness`

**гл.8 — Военный коммунизм (буржуйка, тиф)** [МРАЧНЫЙ]
`A freezing Petrograd room in 1919, a little iron burzhuika stove burning broken furniture and books, a gaunt family huddled in coats indoors, frost on the window, a single candle, breath visible`

**гл.9 — 1920, терпение** [МРАЧНЫЙ]
`A dim communal Petrograd apartment in 1920, a tired man splitting a chair for firewood by a small stove, worn coats hung on the walls, weak grey daylight through a frosted window`

**гл.10 — НЭП (1921, оживший рынок)** [ТЁПЛЫЙ]
`A lively 1921 street market as private trade returns, reopened shop with a sign, stalls piled with bread and goods, a well-fed nepman in a bowler hat, ordinary people bargaining, warm afternoon light, cautious relief`

**гл.10 — Таганцевское дело (аресты интеллигенции, 1921)** [МРАЧНЫЙ]
`Night arrest of the intelligentsia in 1921, men in leather jackets taking a grey-haired professor from a book-lined study, an open suitcase, a woman standing frozen in the doorway, lamplight and shadow`

**гл.11 — Философский пароход (сентябрь 1922)** [МРАЧНЫЙ]
`Professors and writers in overcoats standing on the deck of a steamer pulling away from a grey Petrograd embankment in September 1922, luggage at their feet, the city receding in autumn haze, quiet exile`

---

## Ветка ЧК-чекиста

**гл.7 — Красный террор изнутри** [МРАЧНЫЙ]
`Night, a Cheka operation: men in leather jackets and a dimmed truck in a Moscow lane, lists and lanterns, a prisoner led out, cold and businesslike, no drama`

**Концовка «Щит и меч» (1922, ГПУ)** [МРАЧНЫЙ]
`A GPU officer in a military tunic at a desk in 1922, an honorary badge and a mug, a portrait of the leader on the wall, tired hollow calm, dim office`

---

## Ветка «Юг / белые»

**гл.7 — Ледяной поход (1918)** [МРАЧНЫЙ]
`A column of Volunteer Army officers and cadets trudging through frozen winter steppe, ice caked on their greatcoats, wounded men on jolting carts, a grey blizzard sky, exhaustion`

**гл.8 — Отступление белых, тифозные эшелоны (1919-20)** [МРАЧНЫЙ]
`A retreating white army column and refugee wagons strung along a muddy frozen road, typhus-stricken lying in an open freight car, crows, a broken cart, endless grey distance`

**гл.8 — Новороссийск (март 1920)** [МРАЧНЫЙ]
`Chaos on the Novorossiysk quay in March 1920, a huge crowd of soldiers and refugees fighting to board an overloaded smoking steamer, abandoned horses swimming by the pier, dropped baggage, panic under a cold sky`

**гл.8 — Одесса (эвакуация 1919)** [МРАЧНЫЙ]
`Panic on the Odessa harbour pier in 1919, French zouaves and a mass of fleeing civilians with trunks and bundles pressing toward the gangways of a steamer, grey Black Sea, a scramble for places`

**гл.9 — Перекоп / Сиваш (ноябрь 1920)** [МРАЧНЫЙ]
`Red infantry wading through the icy shallow Sivash at night toward the Turkish Wall of Perekop, flares and gunflashes on the horizon, men chest-deep in freezing water, November cold`

**гл.9 — Севастополь, эвакуация Крыма (ноябрь 1920)** [МРАЧНЫЙ]
`The Crimean evacuation on a Sevastopol quay in November 1920, orderly crowds boarding a long line of ships, soldiers and families with bundles, a grey sea crowded with steamers, quiet finality`

**Концовка «Голое поле» (Галлиполи)** [МРАЧНЫЙ]
`A Russian émigré army camp at Gallipoli, rows of tents on a bare windswept field, ragged soldiers standing in a parade formation refusing to disband, a Turkish shore, harsh light`

**Концовка «Константинополь / 126 судов»** [МРАЧНЫЙ]
`Overloaded ships crammed with refugees arriving at Constantinople, people packed on the decks with bundles, the domes and minarets of the city beyond the grey water, exhaustion and uncertainty`

---

## Ветка «Киев / Одесса (беженцы)»

**гл.7 — Киев 1918 (беженцы, кафе)** [ТЁПЛЫЙ]
`A crowded Kyiv café full of well-dressed refugees in late 1918, warm lamplight, coffee and cigarettes, forced gaiety, uniforms of three different armies at the tables, a tension under the comfort`

---

## Ветка «Деревня»

**гл.7 — Продотряд (1918)** [МРАЧНЫЙ]
`An armed grain-requisition squad with a cart and a machine gun searching a peasant yard, a peasant family standing in silence by their log izba, sacks being carried out, muddy autumn, chickens scattering`

**гл.8 — Голодная зима в деревне (1919)** [МРАЧНЫЙ]
`The dim interior of a peasant izba in winter 1919, a family at a bare table with only potato peelings and bread of chaff, a low oil lamp, an old woman praying in the corner, cold and want`

**гл.9 — Антоновщина (1920-21)** [МРАЧНЫЙ]
`Tambov peasant rebels with rifles and sawn-off shotguns and a homemade banner gathered in a birch forest at dusk, wary faces, a couple of horses, campfire smoke, the tension of hunted men`

**гл.10 — Голод в Поволжье, помощь АРА (1921)** [МРАЧНЫЙ]
`The 1921 Volga famine, gaunt ragged peasants queuing at an ARA relief kitchen, a cauldron of cornmeal porridge, children clutching tin cans, a bleak dusty village square, hollow faces`

---

## Концовки-выживание (доп. картинки)

**Выдвиженец** [ТЁПЛЫЙ]
`A young worker in a clean shirt at a factory committee table with papers and a red banner, or reading at a workers' faculty desk, confident and rising, warm daylight`

**Совслужащий** [ТЁПЛЫЙ]
`A former gentleman now a Soviet office clerk at a desk piled with ledgers and forms, a leader's portrait on the wall, a primus and a shared corner, resigned neatness, grey daylight`

**Гражданин нэпман** [ТЁПЛЫЙ]
`A shopkeeper standing behind the counter of his small 1922 private shop, shelves of goods, an abacus and cash box, a tax inspector's shadow at the door, cautious prosperity, warm light`

**Мужик** [ТЁПЛЫЙ]
`A weathered peasant behind a horse-drawn plough in a spring field, a repaired izba and a new-bought horse, low warm evening sun, quiet hard-won recovery`

**Товарищ делегатка (новая женщина)** [ТЁПЛЫЙ]
`A young woman in a red headscarf teaching women to read at an evening literacy class, a lamp, workers' wives bent over primers, plain room, warm earnest light`

**Краском (военспец)** [ТЁПЛЫЙ]
`A former tsarist officer now a Red Army commander in a budenovka-less field tunic bending over a map with a young commissar beside him, a plain HQ hut, lamplight`

**Бывший человек** [МРАЧНЫЙ]
`A former gentleman with a straight back giving a French lesson for a food ration in a single shabby room shared by several families, an oriel window, threadbare dignity, grey light`

---

## Эмиграция (доп. картинки)

**Стокгольм / Париж** [ТЁПЛЫЙ]
`An elderly Russian émigré in a modest Paris café reading Russian émigré newspapers over coffee, other émigrés at the tables, autumn light through the window, quiet displacement`

**По льду в Финляндию** [МРАЧНЫЙ]
`Two figures crossing the frozen Gulf of Finland at night guided by a smuggler, low crouched against the wind on the ice, a distant searchlight, the far shore a dark line, danger and cold`
