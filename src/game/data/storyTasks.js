export const STORY_TASKS = [
    ['talk-lino', 'Talk to Ranger Lino', 'Meet Ranger Lino and hear your first mission.', 'lino'],
    ['reach-barn', 'Go to the Barn', 'Follow the marker to the barn.', 'barn'],
    ['collect-hay', 'Collect Hay', 'Collect the hay beside the barn.', 'hay'],
    ['find-horse', 'Find the Horse', 'Approach the Domestic Horse.', 'Domestic Horse'],
    ['feed-horse', 'Feed the Horse', 'Hold Feed for 1.5 seconds.', 'Domestic Horse'],
    ['return-lino-horse', 'Return to Ranger Lino', 'Tell Ranger Lino the horse is fed.', 'lino'],
    ['talk-lina', 'Talk to Ranger Lina', 'Ask Ranger Lina how you can help.', 'lina'],
    ['find-carrot', 'Find the Carrot', 'Follow the marker to the garden carrot.', 'carrot'],
    ['collect-carrot', 'Collect the Carrot', 'Collect the carrot for the rabbits.', 'carrot'],
    ['find-rabbits', 'Find the Rabbits', 'Approach the rabbit area.', 'Rabbit'],
    ['feed-rabbit', 'Feed a Rabbit', 'Hold Feed for 1.5 seconds.', 'Rabbit'],
    ['open-animal-book', 'Open the Animal Book', 'Open the book and view the Rabbit entry.', 'book'],
    ['return-lina', 'Talk to Ranger Lina Again', 'Return to Ranger Lina.', 'lina'],
    ['find-alpaca', 'Find the Alpaca', 'Approach the Alpaca quietly.', 'Alpaca'],
    ['observe-alpaca', 'Observe the Alpaca', 'Stay nearby for 4 seconds.', 'Alpaca'],
    ['photo-alpaca', 'Photograph the Alpaca', 'Take a photo while the Alpaca is in view.', 'Alpaca'],
    ['find-monkey', 'Find the Forest Monkey', 'Follow the marker to the Forest Monkey.', 'Forest Monkey'],
    ['observe-monkey', 'Observe the Forest Monkey', 'Stay nearby for 4 seconds.', 'Forest Monkey'],
    ['visit-river', 'Visit the River', 'Remain safely beside the river for 3 seconds.', 'river'],
    ['visit-windmill', 'Visit the Windmill', 'Reach the windmill landmark.', 'windmill'],
    ['visit-statue', 'Visit the Bulusan Statue', 'Remain near the statue for 3 seconds.', 'statue'],
    ['tiger-safety-talk', 'Talk to Ranger Lino About the Tiger', 'Learn how to observe the tiger safely.', 'lino'],
    ['reach-tiger-view', 'Visit the Tiger Viewing Area', 'Reach the safe point outside the enclosure.', 'tiger-view'],
    ['observe-tiger', 'Observe the Bengal Tiger', 'Observe from the safe area for 5 seconds.', 'tiger-view'],
    ['photo-tiger', 'Photograph the Bengal Tiger', 'Take a photo from the safe viewing area.', 'tiger-view'],
    ['feed-three', 'Feed Three Safe Animals', 'Feed three safe animal types not yet fed.', 'unfed'],
    ['discover-five', 'Discover Five Animals', 'Have five different animals in your Animal Book.', 'undiscovered'],
    ['photo-two', 'Take Two Animal Photos', 'Photograph two animals other than the Alpaca and Tiger.', 'photo'],
    ['animal-care', 'Complete the Animal Care Challenge', 'Feed all ten safe animal types.', 'unfed'],
    ['final-lino', 'Return to Ranger Lino', 'Return for your Junior Zoo Ranger award.', 'lino'],
].map(([id, title, instruction, target], index) => ({ id, number: index + 1, title, instruction, target }));

export const STORY_TASK_IDS = STORY_TASKS.map((task) => task.id);
export const SAFE_ANIMAL_NAMES = [
    'White-tailed Deer', 'Domestic Horse', 'Ostrich', 'Donkey', 'Domestic Cow',
    'Alpaca', 'Red Deer Stag', 'Bull', 'Forest Monkey', 'Rabbit',
];

export const STORY_DIALOGUE = {
    'talk-lino': ['Welcome to Bulusan Zoo, explorer.', 'Our animals need your help today.', 'First, go to the barn and collect some hay.'],
    'return-lino-horse': ['Excellent work. The horse is happy and well fed.', 'Ranger Lina needs help caring for the rabbits.', 'Go and speak with her.'],
    'talk-lina': ['Hello, explorer.', 'Our rabbits need a healthy snack.', 'Find a carrot and bring it to them.'],
    'return-lina': ['Rabbits need gentle care. You did very well.', 'Now let us observe another animal without disturbing it.', 'Find the alpaca and watch it quietly.'],
    'tiger-safety-talk': ['The Bengal Tiger is strong and beautiful.', 'We must observe it only from outside its enclosure.', 'Never try to feed or approach a dangerous animal.'],
    'final-lino': ['You cared for the animals and explored the zoo.', 'You learned how to observe wildlife safely.', 'You are now a Junior Zoo Ranger.'],
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
