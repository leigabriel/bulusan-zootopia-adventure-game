// Animal Book entries. Words are kept short and simple so young players can read
// them. `name` is also the id used for saved progress, so never rename it; the
// book shows the translated name through t().
// `picture` is a portrait rendered from the game's own 3D model
// (see scripts/portraits). `category` picks the tab in the book.

export const BOOK_CATEGORIES = [
    { id: 'farm', label: 'Farm', icon: '🐄', color: '#b13a2e' },
    { id: 'forest', label: 'Forest', icon: '🌲', color: '#4f7a3a' },
    { id: 'meadow', label: 'Meadow', icon: '🌼', color: '#c4752e' },
    { id: 'sky', label: 'Birds', icon: '🐦', color: '#3d7c9e' },
    { id: 'water', label: 'Water', icon: '💧', color: '#6b4a7a' },
];

export const ANIMAL_METADATA = [
    { name: 'White-tailed Deer', category: 'forest', picture: 'white-tailed-deer', scientific: 'Odocoileus virginianus', file: 'Deer.gltf', habitat: 'Edges of the forest', diet: 'Leaves, grass and berries', behavior: 'Gentle and careful', status: 'Safe in the wild', fact: 'Its white tail flashes to warn the herd.', description: 'A graceful forest friend. It helps plants grow.', emoji: '🦌' },
    { name: 'Domestic Horse', category: 'farm', picture: 'domestic-horse', scientific: 'Equus caballus', file: 'Horse.gltf', habitat: 'Wide grassy fields', diet: 'Grass, hay and grains', behavior: 'Friendly and curious', status: 'Lives with people', fact: 'Horses can sleep standing up.', description: 'A strong and kind helper that loves open fields.', emoji: '🐎' },
    { name: 'Ostrich', category: 'meadow', picture: 'ostrich', scientific: 'Struthio camelus', file: 'ostrich/scene.gltf', habitat: 'Dry grassy land', diet: 'Plants and little bugs', behavior: 'A very fast runner', status: 'Safe in the wild', fact: 'It is the biggest bird in the world.', description: 'A tall bird with strong legs. It cannot fly, but it runs fast.', emoji: '🐦' },
    { name: 'Donkey', category: 'farm', picture: 'donkey', scientific: 'Equus asinus', file: 'Donkey.gltf', habitat: 'Grassy fields and farms', diet: 'Grass and hay', behavior: 'Patient and hardworking', status: 'Lives with people', fact: 'Its long ears help it stay cool.', description: 'A calm helper that carries heavy loads.', emoji: '🐴' },
    { name: 'Domestic Cow', category: 'farm', picture: 'domestic-cow', scientific: 'Bos taurus', file: 'Cow.gltf', habitat: 'Farms and green pastures', diet: 'Grass and hay', behavior: 'Gentle, lives in a herd', status: 'Lives with people', fact: 'Cows remember their friends.', description: 'A peaceful animal that gives us milk.', emoji: '🐄' },
    { name: 'Alpaca', category: 'farm', picture: 'alpaca', scientific: 'Vicugna pacos', file: 'Alpaca.gltf', habitat: 'Grassy mountains', diet: 'Grass and plants', behavior: 'Quiet and friendly', status: 'Lives with people', fact: 'Its soft wool keeps people warm.', description: 'A fluffy animal from the mountains of South America.', emoji: '🦙' },
    { name: 'Bull', category: 'farm', picture: 'bull', scientific: 'Bos taurus', file: 'Bull.gltf', habitat: 'Farms and grassy fields', diet: 'Grass and hay', behavior: 'Strong and watchful', status: 'Lives with people', fact: 'A bull can remember faces.', description: 'A powerful animal. Give it space and be calm.', emoji: '🐂' },
    { name: 'Forest Monkey', category: 'forest', picture: 'forest-monkey', scientific: 'Macaca fascicularis', file: 'monkey.glb', habitat: 'Warm forests', diet: 'Fruit, seeds and bugs', behavior: 'Playful and clever', status: 'Needs our help', fact: 'Monkeys talk to each other with many sounds.', description: 'A clever climber. It spreads seeds so new trees can grow.', emoji: '🐒' },
    { name: 'Rabbit', category: 'meadow', picture: 'rabbit', scientific: 'Oryctolagus cuniculus', file: 'forest-rabbit.glb', habitat: 'Meadows and edges of woods', diet: 'Grass, herbs and veggies', behavior: 'Quiet and quick', status: 'Lives with people', fact: 'A rabbit\'s teeth never stop growing.', description: 'A small, speedy friend with soft fur and a twitchy nose.', emoji: '🐇' },
    { name: 'Bengal Tiger', category: 'forest', picture: 'bengal-tiger', scientific: 'Panthera tigris tigris', file: 'tiger/scene.gltf', habitat: 'Forests and tall grass', diet: 'Meat', behavior: 'Sneaky and alone', status: 'Needs our help', fact: 'No two tigers have the same stripes.', description: 'A huge wild cat. It needs safe forests to live. Never go close!', emoji: '🐅' },
    { name: 'Parrot', category: 'sky', picture: 'parrot', scientific: 'Psittacidae', file: 'parrot.glb', habitat: 'Warm forests', diet: 'Seeds, nuts and fruit', behavior: 'Loud and smart', status: 'Many kinds', fact: 'Some parrots can say human words.', description: 'A colorful bird that copies sounds.', emoji: '🦜' },
    { name: 'Pigeon', category: 'sky', picture: 'pigeon', scientific: 'Columba livia', file: 'pigeon.glb', habitat: 'Towns, farms and cliffs', diet: 'Seeds and grains', behavior: 'Gentle and friendly', status: 'Safe in the wild', fact: 'A pigeon can find its way home from very far away.', description: 'A gentle bird that is good at finding its way.', emoji: '🐦' },
    { name: 'Owl', category: 'sky', picture: 'owl', scientific: 'Strigidae', file: 'owl.glb', habitat: 'Woods and farmland', diet: 'Mice, bugs and small birds', behavior: 'Quiet night hunter', status: 'Safe in the wild', fact: 'An owl can turn its head almost all the way around.', description: 'A silent hunter at night. It has big eyes and sharp ears.', emoji: '🦉' },
    { name: 'Goat', category: 'farm', picture: 'goat', scientific: 'Capra hircus', file: 'goat.glb', habitat: 'Hills and farms', diet: 'Grass, leaves and bushes', behavior: 'Curious climber', status: 'Lives with people', fact: 'A goat\'s eyes are shaped like rectangles, so it can see very wide.', description: 'A sure-footed climber that loves to nibble leaves.', emoji: '🐐' },
    { name: 'Frog', category: 'water', picture: 'frog', scientific: 'Ranidae', file: 'frog.glb', habitat: 'Ponds and river banks', diet: 'Flies and little bugs', behavior: 'Waits very patiently', status: 'Safe in the wild', fact: 'A frog drinks and breathes a little through its skin.', description: 'A little jumper that rests by the river and sings at dusk.', emoji: '🐸' },
    { name: 'Koi Fish', category: 'water', picture: 'koi-fish', scientific: 'Cyprinus rubrofuscus', file: 'koi.glb', habitat: 'Calm rivers and ponds', diet: 'Plants, bugs and algae', behavior: 'Calm and graceful', status: 'Lives with people', fact: 'A koi can live for more than fifty years.', description: 'A bright fish that glides slowly through still water.', emoji: '🐟' },
];

export const ANIMAL_METADATA_BY_NAME = Object.fromEntries(ANIMAL_METADATA.map((animal) => [animal.name, animal]));

export function getAnimalBookEntry(name) {
    if (name === 'Rabbit (Idle)' || name === 'Rabbit (Walk)') return ANIMAL_METADATA_BY_NAME.Rabbit;
    return ANIMAL_METADATA_BY_NAME[name];
}

export function getAnimalPicture(entry) {
    return entry?.picture ? `/images/animals/${entry.picture}.webp` : '';
}
