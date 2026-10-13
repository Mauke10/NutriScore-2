import { normalizeFoodText } from "./foodText";

// An emoji for a food, guessed from its name — shown left of the name in food
// search and on ingredient rows so a list can be scanned at a glance. Nothing
// is stored: Fineli's English names lead with what the food *is* ("Oat
// porridge, low-fat milk", "Pizza, ham pizza"), so matching the part before
// the first comma is reliable, and Estonian keywords cover the et-names and
// foods you add yourself. Works on the database row (name_en) and the client
// shape (nameEn) alike.
//
// Order matters, first match wins: dishes before their main ingredient (fish
// soup is soup, berry pie is pie), and anything that contains another word
// before that word (sweet potato before sweets, peanut butter before butter,
// ice cream before cream, grapefruit before grape).
const RULES = [
  // Drinks that would otherwise read as their ingredient
  ["🧃", /\b(juice|mahl|mehu|nektar|nectar)/],
  ["🥛", /\b((oat|soya?|soja|rice|almond|hazelnut|coconut|plant|kaera|riisi|mandli) ?(drink|jook|milk|piim)|chocolate milk|berry milk|beestings|colostrum|ternespiim)/],
  ["🍼", /\b(infant formula|imiku)/],
  ["☕", /\b(coffee|kohv|kahvi|espresso|cappuccino|caffe latte|cafe latte|latte\b|cocoa|kakao|hot chocolate|cafe au lait)/],
  ["🍵", /\b(tea|tee)\b/],
  ["💪", /\b(meal replacement|whey|protein (bar|powder|drink|shake|smoothie)|proteiin|profeel)/],
  ["🥤", /\b(soft drink|sport beverage|energy drink|cola|koola|lemonade|limonaad|karastusjook|smoothie|smuuti|milkshake|shake|vitamin water)/],
  ["🍺", /\b(beer|olu\b|cider|siider|long drink|lonkero)/],
  ["🍸", /\b(cocktail|kokteil|martini|bloody mary|screwdriver|mojito|punch|mead|sima\b|glogg|glogi|mulled)/],
  ["🍷", /\b(wine|vein|champagne|sparkling)/],
  ["🥃", /\b(vodka|viin\b|whisk|liqueur|likoor|cognac|brandy|rum\b|gin\b|spirit)/],
  ["💧", /\b(mineral water|water\b|vesi\b)/],

  // Dishes
  ["🍕", /\bpizza/],
  ["🌭", /\b(hot ?dog|frankfurter|wiener|viiner|sausage|vorst|bratwurst|chorizo|salami|nakk)/],
  ["🍔", /\b(hamburger|burger|porilainen)/],
  ["🥪", /\b(sandwich|panini|voileib|vorileib|toast with)/],
  ["🌯", /\b(tortilla|burrito|wrap|kebab|quesadilla|lavash|shawarma)/],
  ["🍣", /\b(sushi|maki|nigiri)/],
  ["🥟", /\b(dumpling|pelmeen|pelmid|pelmeni|pasty|pirukas|pirukad|samosa|gyoza|ravioli)/],
  ["🥗", /\b(salad(?! dressing)|salat\b|salati|coleslaw|caesar(?! dressing))/],
  ["🥫", /\b(sauce|kaste\b|dressing|mayonnaise|majonees|ketchup|ketsup|mustard|sinep|pesto|salsa|dip\b|tzatziki|relish|vinaigrette|guacamole)/],
  ["🍲", /\b(soup|supp|stew|hot pot|goulash|gulas|ragout|chili con carne|curry|gravy|stroganoff|tikka|masala|bolognese|chowder|borscht|seljanka|solyanka|hautis|kaste)/],
  ["🥘", /\b(casserole|risotto|paella|moussaka|lasagne|lasanje|hash\b|wok|stir fry|pilaf|plov|ready meal|vormiroog|pada\b|laatikko|stuffed cabbage)/],
  ["🍝", /\b(pasta|spaghetti|spagett|macaroni|makaron|noodle|nuudel|carbonara|penne|fusilli|tagliatelle|gnocchi)/],
  ["🍳", /\b(omelette|omlet|munakas|fried egg|scrambled|munaroog)/],
  ["🥞", /\b(pancake|pannkook|crepe|kreps|blini?\b|ohukai)/],
  ["🧇", /\b(waffle|vahvl)/],
  ["🍩", /\b(doughnut|donut|soorik|berliner)/],
  ["🧁", /\b(muffin|cupcake|mokkapal)/],
  ["🍚", /\b(rice cake|rice cracker|riisigalett|maisigalett)/],
  ["🍰", /\b(cake|cheesecake|kook\b|kook,|tort|swiss roll|rullbiskviit|pastry|leivos|brownie|tiramisu|kringel|meringue|beseee|profiterole|shortcake)/],
  ["🥧", /\b(pie\b|pies\b|piiras|quiche|tart\b|tarte|crumble)/],
  ["🥨", /\b(pretzel|rinkeli|salt stick)/],
  ["🥯", /\bbagel/],
  ["🥐", /\b(croissant|danish pastry|bun\b|buns\b|cinnamon|pulla|saiake|kaneel|vastla)/],
  ["🍪", /\b(biscuit|cookie|keks|kupsis|cracker|wafer|gingerbread|piparkook)/],
  ["🍦", /\b(ice cream|jaatis|sorbet|frozen yoghurt|parfait|popsicle|ice lolly)/],
  ["🍮", /\b(pudding|vanukas|custard|mousse|kissel|kisell|jelly|tarretis|dessert|pasha|pascha|creme\b|vanillacreme|creme brulee)/],
  ["🥣", /\b(porridge|puder|gruel|cereal|muesli|musli|granola|helbed|flakes|kama\b|talkkuna|crunchy)/],
  ["🍿", /\bpopcorn/],
  ["🍟", /\b(french fries|fries|friikart|crisps|chips|krops|sipsi)/],

  // Proteins
  ["🦐", /\b(shrimp|prawn|krevet|crayfish|vahk|lobster|crab|krabi|squid|kalmaar|mussel|rannakarp|oyster|seafood|mereand)/],
  ["🐟", /\b(fish|kala|salmon|lohe|tuna|tuunikala|herring|heeringas|raim|baltic herring|cod\b|tursk|mackerel|makrell|trout|forell|perch|ahven|pike\b|haug|saithe|pollock|sprat|kilu|sardin|pangasius|tilapia|hake\b|vendace|rapsik|powan|siig|flounder|lest\b|roe\b|kaaviar|caviar|eel\b|angerjas|zander|koha\b|bream|latikas|anchov|whitefish|burbot|luts|redfish|halibut|paltus|lamprey|silm\b|roach|sarg\b|lutefi|catfish)/],
  ["🍗", /\b(chicken|kana|broiler|turkey|kalkun|poultry|duck|part\b|hen\b|drumstick|nugget|wings?\b|tiivad)/],
  ["🥓", /\b(bacon|peekon|fatback|pekk)/],
  ["🍖", /\b(ham\b|sink|cold cuts|meatball|lihapall|kotlet|meatloaf|pate\b|pastee|liver pate|ribs?\b|ribid|kebab meat|jelly meat|sult)/],
  ["🥩", /\b(beef|veis|pork|siga\b|sea\b(?! buckthorn)|sealiha|seahakk|lamb|lammas|mutton|veal|vasika|elk|moose|pothr|reindeer|poro|venison|hirv|meat\b|meat,|liha|mince|hakk|steak|steik|schnitzel|snitsel|liver|maks|kidney|neer|tongue|keel\b|sirloin|tenderloin|filee|fillet|kassler|roast|praad|chop\b|karbonaad|hare\b|janes|rabbit|kuulik|game\b|game bird|blood\b|veri\b)/],
  ["🍳", /\b(egg,? fried)/],
  ["🥚", /\b(egg|muna|kanamuna|munavalge|munakollane)/],
  ["🫘", /\b(bean|uba\b|oad\b|lentil|laats|chick ?pea|kikerher|hummus|soy|soja|tofu|tempeh|edamame|mifu|harkis|quorn|pulled oats|nyhtokaura)/],

  // Dairy and fats (cheese before milk so cream cheese is cheese; nuts before
  // butter so peanut butter is a nut)
  ["🧀", /\b(cheese|juust|halloumi|feta|mozzarella|parmesan|parmesaan|cottage|mascarpone|brie|camembert|ricotta|gouda|edam|cheddar|kodujuust)/],
  ["🫒", /\b(olive|oliiv|oil\b|oil,|oli\b|oli,)/],
  ["🥥", /\b(coconut|kookos)/],
  ["🥜", /\b(nut|nuts|pahkel|pahkli|peanut|maapahkel|almond|mandel|cashew|walnut|hazelnut|pecan|pistachio|macadamia|seed|seemned|seemne|sunflower|pumpkin seed|chia|flax|linseed|sesame|seesam|hemp|tahini|marzipan|martsipan)/],
  ["🥛", /\b(milk|piim|buttermilk|kefir|keefir|yoghurt|yogurt|jogurt|quark|kohupiim|kohuke|skyr|curd|cream|koor\b|vahukoor|hapukoor|smetana|creme fraiche|lassi|ayran|pett\b|drink\b|drink,|jook\b|lactose)/],
  ["🧈", /\b(butter|voi\b|margarine|margariin|spread|levite|ghee|lard|seapekk|fat\b|rasv)/],

  // Starches and grains
  ["🍞", /\b(bread|leib|leiva|toast|rostsai|rusk\b|kuivik|sai\b|sai,|saia|baguette|roll\b|rolls\b|kukkel|crispbread|crisp ?bread|nakileib|flatbread|rieska|pita|ciabatta|focaccia|crouton|krutoon|papadum)/],
  ["🍚", /\b(rice|riis)/],
  ["🍠", /\b(sweet potato|bataat)/],
  ["🥔", /\b(potato|kartul)/],
  ["🌾", /\b(flour|jahu|wheat|nisu|barley|oder|rye\b|rukis|rukki|oat\b|oats\b|oat,|kaer|bran\b|kli\b|semolina|manna|bulgur|couscous|kuskus|quinoa|kinoa|millet|hirss|buckwheat|tatar|grain|groats|tangud|starch|tarklis|yeast|parm\b|dough|tainas|maizena)/],

  // Vegetables
  ["🥑", /\b(avocado|avokaado|avokado)/],
  ["🍆", /\b(aubergine|eggplant|baklazaan)/],
  ["🎃", /\b(pumpkin|korvits|squash)/],
  ["🥒", /\b(cucumber|kurk\b|kurgi|zucchini|courgette|suvikorvits|pickle|gherkin)/],
  ["🍅", /\b(tomato|tomat)/],
  ["🌶️", /\b(chili|chilli|tsilli|jalapeno)/],
  ["🫑", /\b(sweet pepper|bell pepper|paprika)/],
  ["🧄", /\b(garlic|kuuslauk)/],
  ["🧅", /\b(onion|sibul|shallot|leek|porru)/],
  ["🍄", /\b(morel|kogrits|mushroom|seen\b|seened|champignon|sampinjon|chanterelle|kukeseen|porcini|puravik|milkcap|riisikas|funnel)/],
  ["🌽", /\b(sweet corn|corn\b|corn,|mais\b|maize)/],
  ["🥕", /\b(carrot|porgand|root vegetable|juurvili|parsnip|pastinaak|swede|kaalikas|turnip|naeris|celeriac|juurseller|beetroot|peet|radish|redis|horseradish|madar|salsify|jerusalem artichoke)/],
  ["🥦", /\b(broccoli|brokoli|cauliflower|lillkapsas|brussels|vegetable|vegetables|koogivili|kooliviljad|asparagus|spargel|artichoke|green bean)/],
  ["🫛", /\b(pea\b|peas\b|pea,|hernes|herned|sugar snap)/],
  ["🥬", /\b(cabbage|kapsas|kale|lehtkapsas|lettuce|salat\b|spinach|spinat|chard|rocket|rucola|arugula|celery|seller|bok choy|sauerkraut|hapukapsas|sprout|idud|shoot|corn salad|radicchio|endive|nettle|nogeses|seaweed|merevetik|nori|wakame|kombu|kohlrabi|nuikapsas|fennel|apteegitill)/],
  ["🌿", /\b(herb|dill|till\b|parsley|petersell|basil|basiilik|coriander|koriander|mint\b|piparmund|thyme|tuumian|oregano|rosemary|rosmariin|chive|murulauk|cress|kress|ginger|ingver)/],

  // Fruit (citrus before grape so grapefruit is citrus; pineapple before apple)
  ["🍍", /\b(pineapple|ananass?)/],
  ["🍋", /\b(lemon|sidrun|lime\b|laim)/],
  ["🍊", /\b(orange|apelsin|mandarin|clementine|tangerine|citrus|grapefruit|greip|sharon|persimmon|persimon|kaki\b)/],
  ["🍌", /\b(banana|banaan)/],
  ["🍎", /\b(apple|ouna|ounad)/],
  ["🍐", /\b(pear\b|pears\b|pirn)/],
  ["🍇", /\b(grape|viinamar|raisin|rosin|currant\b|fig\b|figs\b|viigi|date\b|dates\b|datli|taatel|prune|ploomikuivat|dried fruit|kuivatatud puuvili)/],
  ["🍓", /\b(strawberr|maasik|raspberr|vaarik|cloudberr|murakas|rhubarb|rabarber)/],
  ["🍒", /\b(cherry|cherries|kirss)/],
  ["🍑", /\b(peach|virsik|apricot|aprikoos|nectarine|plum\b|plums\b|ploom)/],
  ["🥭", /\b(mango|papaya|papaia|passion fruit|guava|lychee)/],
  ["🍉", /\b(melon|arbuus|watermelon)/],
  ["🥝", /\bkiwi/],
  ["🫐", /\b(blueberr|bilberr|mustik|lingonberr|pohl|cranberr|johvik|blackcurrant|redcurrant|sostar|gooseberr|karusmari|sea buckthorn|astelpaju|rowan|pihlakas|elderberr|rose hip|kibuvits|berry|berries|marja|mari\b|marjad)/],
  ["🌰", /\b(chestnut|kastan)/],
  ["🍎", /\b(fruit|puuvili|puuvilja|pomegranate|granaatoun)/],

  // Sweet things and pantry
  ["🍫", /\b(chocolate|sokolaad|snickers|bar\b|batoon|nougat)/],
  ["🍯", /\b(honey|mesi\b|syrup|siirup|treacle)/],
  ["🍬", /\b(sweet\b|sweets\b|candy|kommi|komm\b|caramel|karamell|toffee|marshmallow|liquorice|lakrits|pastille|marmalade|marmelaad|sugar|suhkur|fructose|glucose|sweetener|magusaine|stevia|sorbitol|xylitol|maltodextrin|icing|glasuur|chewing gum|narimiskumm|liqourice|salmiak|jam\b|moos\b|jam,)/],
  ["🐌", /\bsnail/],
  ["🧂", /\b(seasalt|salt\b|sool\b|spice|vurts|pepper|pipar|vinegar|aadikas|baking powder|kupsetuspulber|soda\b|bouillon|puljong|stock\b|seasoning|maitseaine|gelatin|zelatiin|curry powder)/]
];

const FALLBACK = "🍽️";

export function foodIcon(food) {
  if (!food) return FALLBACK;
  const name = normalizeFoodText(food.name);
  const en = normalizeFoodText(food.name_en || food.nameEn);
  // "Potatoes in low-fat milk", "Baltic herring in tomato sauce", "Pasta
  // with cheese sauce": the food is what comes before in / with / coated.
  const head = (s) => s.split(",")[0].replace(/ (with|without|in|coated)\b.*$/, "").trim();
  // Most telling text first: the English head is Fineli's own category word;
  // the Estonian head covers et-names; then whole names for custom foods like
  // "Profeel metsmarja jook" where the telling word isn't first.
  const texts = [head(en), head(name), name, en, ...(food.aliases || []).map(normalizeFoodText)];
  for (const t of texts) {
    if (!t) continue;
    for (const [icon, re] of RULES) if (re.test(t)) return icon;
  }
  return FALLBACK;
}
