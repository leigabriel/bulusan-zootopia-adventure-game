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
    { name: 'White-tailed Deer', category: 'forest', picture: 'white-tailed-deer', scientific: 'Odocoileus virginianus', file: 'Deer.gltf', habitat: 'Edges of the forest', diet: 'Leaves, grass and berries', behavior: 'Gentle and careful', status: 'Safe in the wild', fact: 'Its white tail flashes to warn the herd.', description: 'A deer is a gentle animal with long legs and a short tail. Some deer have antlers on their heads. They like eating grass, leaves, and plants.', emoji: '🦌' },
    { name: 'Domestic Horse', category: 'farm', picture: 'domestic-horse', scientific: 'Equus caballus', file: 'Horse.gltf', habitat: 'Wide grassy fields', diet: 'Grass, hay and grains', behavior: 'Friendly and curious', status: 'Lives with people', fact: 'Horses can sleep standing up.', description: 'A horse is a strong animal with four long legs and a long tail. It can run very fast and is often used for riding. Horses eat grass and hay.', emoji: '🐎' },
    { name: 'Ostrich', category: 'meadow', picture: 'ostrich', scientific: 'Struthio camelus', file: 'ostrich/scene.gltf', habitat: 'Dry grassy land', diet: 'Plants and little bugs', behavior: 'A very fast runner', status: 'Safe in the wild', fact: 'It is the biggest bird in the world.', description: 'An ostrich is a very large bird that cannot fly. It has a long neck, long legs, and strong feet. It can run very fast!', emoji: '🐦' },
    { name: 'Donkey', category: 'farm', picture: 'donkey', scientific: 'Equus asinus', file: 'Donkey.gltf', habitat: 'Grassy fields and farms', diet: 'Grass and hay', behavior: 'Patient and hardworking', status: 'Lives with people', fact: 'Its long ears help it stay cool.', description: 'A donkey is a small animal related to horses. It has long ears and strong legs. It is known for carrying heavy things and eating grass.', emoji: '🐴' },
    { name: 'Domestic Cow', category: 'farm', picture: 'domestic-cow', scientific: 'Bos taurus', file: 'Cow.gltf', habitat: 'Farms and green pastures', diet: 'Grass and hay', behavior: 'Gentle, lives in a herd', status: 'Lives with people', fact: 'Cows remember their friends.', description: 'A cow is a farm animal that eats grass and other plants. It gives us milk that people can drink. Cows have four legs and a long tail.', emoji: '🐄' },
    { name: 'Alpaca', category: 'farm', picture: 'alpaca', scientific: 'Vicugna pacos', file: 'Alpaca.gltf', habitat: 'Grassy mountains', diet: 'Grass and plants', behavior: 'Quiet and friendly', status: 'Lives with people', fact: 'Its soft wool keeps people warm.', description: 'An alpaca is a fluffy animal with a long neck and soft wool. It looks a little like a small llama. It eats grass and plants.', emoji: '🦙' },
    { name: 'Bull', category: 'farm', picture: 'bull', scientific: 'Bos taurus', file: 'Bull.gltf', habitat: 'Farms and grassy fields', diet: 'Grass and hay', behavior: 'Strong and watchful', status: 'Lives with people', fact: 'A bull can remember faces.', description: 'A bull is a strong male cow. It has a large body and may have horns on its head. It eats grass and other plants.', emoji: '🐂' },
    { name: 'Forest Monkey', category: 'forest', picture: 'forest-monkey', scientific: 'Macaca fascicularis', file: 'monkey.glb', habitat: 'Warm forests', diet: 'Fruit, seeds and bugs', behavior: 'Playful and clever', status: 'Needs our help', fact: 'Monkeys talk to each other with many sounds.', description: 'A monkey is a playful animal that can climb trees. It has strong arms, hands, and sometimes a long tail. Monkeys enjoy eating fruits and other foods.', emoji: '🐒' },
    { name: 'Rabbit', category: 'meadow', picture: 'rabbit', scientific: 'Oryctolagus cuniculus', file: 'forest-rabbit.glb', habitat: 'Meadows and edges of woods', diet: 'Grass, herbs and veggies', behavior: 'Quiet and quick', status: 'Lives with people', fact: 'A rabbit\'s teeth never stop growing.', description: 'A rabbit is a small, fluffy animal with long ears and strong back legs. It can hop and run quickly. Rabbits enjoy eating grass and leafy vegetables.', emoji: '🐇' },
    { name: 'Bengal Tiger', category: 'forest', picture: 'bengal-tiger', scientific: 'Panthera tigris tigris', file: 'tiger/scene.gltf', habitat: 'Forests and tall grass', diet: 'Meat', behavior: 'Sneaky and alone', status: 'Needs our help', fact: 'No two tigers have the same stripes.', description: 'A tiger is a large wild cat with orange fur and black stripes. It has sharp teeth and strong paws. Tigers are skilled hunters and usually live alone.', emoji: '🐅' },
    { name: 'Parrot', category: 'sky', picture: 'parrot', scientific: 'Psittacidae', file: 'parrot.glb', habitat: 'Warm forests', diet: 'Seeds, nuts and fruit', behavior: 'Loud and smart', status: 'Many kinds', fact: 'Some parrots can say human words.', description: 'A parrot is a colorful bird with a curved beak and strong feet. Some parrots can copy sounds and words they hear. They enjoy eating fruits, seeds, and nuts.', emoji: '🦜' },
    { name: 'Pigeon', category: 'sky', picture: 'pigeon', scientific: 'Columba livia', file: 'pigeon.glb', habitat: 'Towns, farms and cliffs', diet: 'Seeds and grains', behavior: 'Gentle and friendly', status: 'Safe in the wild', fact: 'A pigeon can find its way home from very far away.', description: 'A pigeon is a bird that can fly using its wings. It has a small head, a short beak, and a round body. Pigeons often eat seeds and grains.', emoji: '🐦' },
    { name: 'Owl', category: 'sky', picture: 'owl', scientific: 'Strigidae', file: 'owl.glb', habitat: 'Woods and farmland', diet: 'Mice, bugs and small birds', behavior: 'Quiet night hunter', status: 'Safe in the wild', fact: 'An owl can turn its head almost all the way around.', description: 'An owl is a bird with large eyes and a round face. It can see well in low light and is often active at night. Owls eat small animals like mice and insects.', emoji: '🦉' },
    { name: 'Goat', category: 'farm', picture: 'goat', scientific: 'Capra hircus', file: 'goat.glb', habitat: 'Hills and farms', diet: 'Grass, leaves and bushes', behavior: 'Curious climber', status: 'Lives with people', fact: 'A goat\'s eyes are shaped like rectangles, so it can see very wide.', description: 'A goat is a farm animal that can climb rocky places. It has four legs and may have horns. Goats eat grass, leaves, and other plants.', emoji: '🐐' },
    { name: 'Frog', category: 'water', picture: 'frog', scientific: 'Ranidae', file: 'frog.glb', habitat: 'Ponds and river banks', diet: 'Flies and little bugs', behavior: 'Waits very patiently', status: 'Safe in the wild', fact: 'A frog drinks and breathes a little through its skin.', description: 'A frog is a small animal that can live both on land and in water. It has strong back legs for jumping and swimming. Frogs usually eat insects.', emoji: '🐸' },
    { name: 'Koi Fish', category: 'water', picture: 'koi-fish', scientific: 'Cyprinus rubrofuscus', file: 'koi.glb', habitat: 'Calm rivers and ponds', diet: 'Plants, bugs and algae', behavior: 'Calm and graceful', status: 'Lives with people', fact: 'A koi can live for more than fifty years.', description: 'Koi are colorful fish often kept in garden ponds. They have beautiful patterns of colors like orange, white, black, and yellow. They swim using their fins and tails.', emoji: '🐟' },
];

export const ANIMAL_METADATA_BY_NAME = Object.fromEntries(ANIMAL_METADATA.map((animal) => [animal.name, animal]));

export function getAnimalBookEntry(name) {
    if (name === 'Rabbit (Idle)' || name === 'Rabbit (Walk)') return ANIMAL_METADATA_BY_NAME.Rabbit;
    return ANIMAL_METADATA_BY_NAME[name];
}

export function getAnimalPicture(entry) {
    return entry?.picture ? `/images/animals/${entry.picture}.webp` : '';
}
