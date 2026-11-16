export const STORY_TASKS = [
    ['talk-lino', 'Talk to Ranger Lino', 'Say hello to Ranger Lino. He has your first job.', 'lino'],
    ['reach-barn', 'Go to the Barn', 'Follow the arrow to the barn.', 'barn'],
    ['collect-hay', 'Get Some Hay', 'Pick up the hay next to the barn.', 'hay'],
    ['find-horse', 'Find the Horse', 'Walk up to the Horse.', 'Domestic Horse'],
    ['feed-horse', 'Feed the Horse', 'Hold the Feed button for a moment.', 'Domestic Horse'],
    ['return-lino-horse', 'Go Back to Ranger Lino', 'Tell Ranger Lino the horse is full and happy.', 'lino'],
    ['talk-lina', 'Talk to Ranger Lina', 'Ask Ranger Lina how you can help.', 'lina'],
    ['find-carrot', 'Find the Carrot', 'Follow the arrow to the carrots in the garden.', 'carrot'],
    ['collect-carrot', 'Pick a Carrot', 'Pick a carrot for the rabbits.', 'carrot'],
    ['find-rabbits', 'Find the Rabbits', 'Walk up to the rabbits.', 'Rabbit'],
    ['feed-rabbit', 'Feed a Rabbit', 'Hold the Feed button for a moment.', 'Rabbit'],
    ['open-animal-book', 'Open the Animal Book', 'Open the book and read about the Rabbit.', 'book'],
    ['return-lina', 'Talk to Ranger Lina Again', 'Go back to Ranger Lina.', 'lina'],
    ['find-alpaca', 'Find the Alpaca', 'Walk slowly up to the Alpaca.', 'Alpaca'],
    ['observe-alpaca', 'Watch the Alpaca', 'Stay close and watch it for a few seconds.', 'Alpaca'],
    ['photo-alpaca', 'Take a Photo of the Alpaca', 'Take a photo with the Alpaca in it.', 'Alpaca'],
    ['find-monkey', 'Find the Forest Monkey', 'Follow the arrow to the Forest Monkey.', 'Forest Monkey'],
    ['observe-monkey', 'Watch the Forest Monkey', 'Stay close and watch it for a few seconds.', 'Forest Monkey'],
    ['visit-river', 'Visit the River', 'Stand near the river for a few seconds. Stay on the bank.', 'river'],
    ['visit-windmill', 'Visit the Windmill', 'Walk to the windmill.', 'windmill'],
    ['visit-statue', 'Visit the Bulusan Statue', 'Stay near the statue for a few seconds.', 'statue'],
    ['tiger-safety-talk', 'Talk to Ranger Lino About the Tiger', 'Learn how to see the tiger safely.', 'lino'],
    ['reach-tiger-view', 'Visit the Tiger Viewing Spot', 'Walk to the safe spot outside the tiger\'s home.', 'tiger-view'],
    ['observe-tiger', 'Watch the Bengal Tiger', 'Watch the tiger from the safe spot for a few seconds.', 'tiger-view'],
    ['photo-tiger', 'Take a Photo of the Bengal Tiger', 'Take a photo from the safe spot.', 'tiger-view'],
    ['feed-three', 'Feed Three Animals', 'Feed three animals you have not fed yet.', 'unfed'],
    ['discover-five', 'Meet Five Animals', 'Get five different animals into your Animal Book.', 'undiscovered'],
    ['photo-two', 'Take Two Animal Photos', 'Take photos of two animals. Not the Alpaca or the Tiger.', 'photo'],
    ['animal-care', 'Feed All the Animals', 'Feed all 13 friendly animals.', 'unfed'],
    ['final-lino', 'Go Back to Ranger Lino', 'Go back to get your Junior Zoo Ranger prize.', 'lino'],
].map(([id, title, instruction, target], index) => ({ id, number: index + 1, title, instruction, target }));

export const STORY_TASK_IDS = STORY_TASKS.map((task) => task.id);
export const SAFE_ANIMAL_NAMES = [
    'White-tailed Deer', 'Domestic Horse', 'Ostrich', 'Donkey', 'Domestic Cow',
    'Alpaca', 'Red Deer Stag', 'Bull', 'Forest Monkey', 'Rabbit',
    // Newer arrivals: only part of the feeding tasks, not of the find or observe tasks.
    'Goat', 'Parrot', 'Pigeon',
];

export const STORY_DIALOGUE = {
    'talk-lino': ['Welcome to Bulusan Zoo, explorer!', 'The animals need your help today.', 'First, go to the barn and get some hay.'],
    'return-lino-horse': ['Great job! The horse is full and happy.', 'Ranger Lina needs help with the rabbits.', 'Please go and talk to her.'],
    'talk-lina': ['Hello, explorer!', 'The rabbits would love a healthy snack.', 'Find a carrot and bring it to them.'],
    'return-lina': ['You were very gentle with the rabbits. Well done!', 'Now let us watch another animal quietly.', 'Find the alpaca and watch it.'],
    'tiger-safety-talk': ['The Bengal Tiger is big and strong.', 'We can only look at it from outside its home.', 'Never go close to a dangerous animal.'],
    'final-lino': ['You took care of the animals and explored the zoo.', 'You learned how to watch animals safely.', 'Now you are a Junior Zoo Ranger!'],
};

export const DEFAULT_STORY_PROGRESS = {
    version: 2,
    activeTaskId: STORY_TASK_IDS[0],
    completedTaskIds: [],
    hasHay: false,
    hasCarrot: false,
    observationMs: 0,
    photoAnimals: [],
    feedThreeBaseline: [],
    rewardClaimed: false,
    certificateUnlocked: false,
};

function uniqueKnown(values, allowed = null) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value) => typeof value === 'string' && (!allowed || allowed.includes(value))))];
}

export function normalizeStoryProgress(value) {
    const source = value && typeof value === 'object' ? value : {};
    let completedTaskIds = uniqueKnown(source.completedTaskIds, STORY_TASK_IDS);

    // Preserve compatible progress from the former three-flag mission.
    if (completedTaskIds.length === 0 && source.version !== 2) {
        if (source.talkedToRanger) completedTaskIds.push('talk-lino');
        if (source.fedHorse) completedTaskIds.push('reach-barn', 'collect-hay', 'find-horse', 'feed-horse');
        if (source.fedRabbit) completedTaskIds.push('return-lino-horse', 'talk-lina', 'find-carrot', 'collect-carrot', 'find-rabbits', 'feed-rabbit');
    }

    const completedSet = new Set(completedTaskIds);
    const firstIncomplete = STORY_TASKS.find((task) => !completedSet.has(task.id));
    // A sequential story may only contain a completed prefix.
    completedTaskIds = STORY_TASK_IDS.slice(0, firstIncomplete ? firstIncomplete.number - 1 : STORY_TASK_IDS.length);
    const activeTaskId = firstIncomplete?.id || STORY_TASK_IDS.at(-1);

    return {
        ...DEFAULT_STORY_PROGRESS,
        activeTaskId,
        completedTaskIds,
        hasHay: source.hasHay === true,
        hasCarrot: source.hasCarrot === true,
        observationMs: Number.isFinite(source.observationMs) ? Math.max(0, source.observationMs) : 0,
        photoAnimals: uniqueKnown(source.photoAnimals),
        feedThreeBaseline: uniqueKnown(source.feedThreeBaseline, SAFE_ANIMAL_NAMES),
        rewardClaimed: source.rewardClaimed === true,
        certificateUnlocked: source.certificateUnlocked === true,
    };
}

export function completeActiveStoryTask(progress, taskId, updates = {}) {
    const current = normalizeStoryProgress(progress);
    if (current.activeTaskId !== taskId || current.completedTaskIds.includes(taskId)) return current;
    const index = STORY_TASK_IDS.indexOf(taskId);
    if (index < 0) return current;
    const completedTaskIds = [...current.completedTaskIds, taskId];
    return normalizeStoryProgress({
        ...current,
        ...updates,
        completedTaskIds,
        activeTaskId: STORY_TASK_IDS[index + 1] || STORY_TASK_IDS[index],
        observationMs: 0,
    });
}

export function getActiveStoryTask(progress) {
    const normalized = normalizeStoryProgress(progress);
    return STORY_TASKS.find((task) => task.id === normalized.activeTaskId) || STORY_TASKS[0];
}
