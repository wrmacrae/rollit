import { Comment, Context, Devvit, Listing, Post, RichTextBuilder, useState, useForm } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
})

function totalScoreOfComments(comments : Comment[]) {
  let totalScore = 0;
  for (const c: Comment of comments) {
    if (c.score > 0) {
      totalScore += c.score;
    }
  }
  return totalScore;
}

function randomCommentByScoreWeight(comments : Comment[]) {
  const totalScore = totalScoreOfComments(comments)
  let r = Math.floor(Math.random() * totalScore)
  for (const c: Comment of comments) {
    if (c.score > 0) {
      r -= c.score;
    }
    if (r <= 0) {
      return c;
    }
  }
}

function getChapterOfTitle(title: String) {
  const chapterMatches = title.match(/\d+/);
  if (chapterMatches) {
    return parseInt(chapterMatches[0], 10)
  }
  return 1
}

function incrementChapterOfTitle(title: String) {
  const chapter = getChapterOfTitle(title)
  if (title.includes(String(chapter))) {
    return title.replace(String(chapter), String(chapter+1)) 
  }
  return `Chapter ${chapter + 1}: ${title}`
   
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

type StoryOutcome = {
  range: [number, number];
  outcome: string;
};

function determineOutcome(roll: number, outcomes: StoryOutcome[]): string {
  for (const { range, outcome } of outcomes) {
      if (roll >= range[0] && roll <= range[1]) {
          return outcome;
      }
  }
  return "You won't believe what happened next!";
}


function processTextForRolls(text: string) {
  const initialTextRegex = /^(.*?)(?=\d+(?:-\d+)?:)/s;
  const match = initialTextRegex.exec(text);

  const initialText = match ? match[1].trim() : "";
  const outcomes: StoryOutcome[] = [];
  const outcomeRegex = /(\d+)(?:-(\d+))?:\s*([^:]+?)(?=\s*\d+(?:-\d+)?:|$)/g;

  let outcomeMatch;
  while ((outcomeMatch = outcomeRegex.exec(text)) !== null) {
      const start = parseInt(outcomeMatch[1], 10);
      const end = outcomeMatch[2] ? parseInt(outcomeMatch[2], 10) : start;
      const outcome = outcomeMatch[3].trim();
      outcomes.push({ range: [start, end], outcome });
  }
  if (outcomes.length > 0) {
    const roll = rollD20();
    const outcome = determineOutcome(roll, outcomes);  
    return `${initialText} ${outcome}`
  }
  return text
}

Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {
    const post = (await context.reddit.getPostById(event.comment?.postId!))
    const chapter = getChapterOfTitle(post.title)
    const comments = await post.comments.all()
    if (totalScoreOfComments(comments) < chapter) {
      return
    }

    const newChapter = processTextForRolls(randomCommentByScoreWeight(comments)?.body!)
    const title = incrementChapterOfTitle(post.title)
    const body = `${post.body}\n\n${newChapter}`;
    const subreddit = (await context.reddit.getCurrentSubreddit()).name;

    await post.lock()
    await context.reddit.submitPost({
      subredditName: subreddit,
      title: title,
      text: body,
    })
  }
})


// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: 'Start a Story',
  location: 'subreddit',
  forUserType: 'moderator',

  onPress: async (_, context) => {
    const { reddit, ui, userId } = context;
    // const currentSubreddit = await reddit.getCurrentSubreddit();
    // const subName = currentSubreddit.name;
    const user = await reddit.getUserById(userId!);

    if (user) ui.showForm(postForm);
  },
});

const postForm = Devvit.createForm(
  (data) => {
    return {
      fields: [
        {
          type: 'string',
          name: 'start',
          label: 'How does it start?',
          required: true,
        },
       ],
       title: 'Start a Story',
       acceptLabel: 'Post',
    } as const; 
  }, async ({ values }, context) => {
    const { reddit } = context
    const { title, start } = values
    if (!values.title || !values.start) return;
    const post = await reddit.submitPost({
      title: `Chapter 1: ${start}`,
      text: start,
      subredditName: "squerp",
      preview: (
        <vstack>
          <text color="black white">Loading...</text>
        </vstack>
      ),
    });
  }
);


const CommentApp: Devvit.CustomPostComponent = (context) => {
  const { reddit } = context;
  const postId = context.postId!
  // const [body, setBody] = useState<string>(`You're the lone guard of a caravan, and along the road to Phandelver you spot a broken down wagon.`);
  const [body, setBody] = useState<string>(async () => (await reddit.getPostById(postId).then((post) => post.body!)));
  const [title, setTitle] = useState<string>(async () => (await reddit.getPostById(postId).then((post) => post.title!)));
  var cleanedBody = body.replace(/#\s*(DX_Bundle|DX_Config|DX_Cached):\s*\S+\s*/g, '').trim();
  if (cleanedBody == "") { cleanedBody = title }
  // async () => {reddit.getPostById(postId)).body})
  // const body = (await reddit.getPostById(postId)).body

  const commentForm = useForm({
    fields: [
      {
        type: 'string',
        name: 'fixedContent',
        label: 'What Happens Next?',
        required: true,
      },
      {
        type: 'string',
        name: 'firstOutcome',
        label: '1-9: (Something that goes bad)',
        required: true,
      },
      {
        type: 'string',
        name: 'secondOutcome',
        label: '10-18: (Something that goes well)',
        required: true,
      },
      {
        type: 'string',
        name: 'thirdOutcome',
        label: '18-20: (Something that goes extremely well)',
        required: true,
      },
    ]
  }, async (values) => {
    if (!values.fixedContent) return;
    reddit.submitComment({text: `${values.fixedContent} 1-9: ${values.firstOutcome} 10-18: ${values.secondOutcome} 19-20: ${values.thirdOutcome}`, id: context.postId ? context.postId! : "F"})
  });

  return (
    <vstack height="100%" width="100%" gap="medium" padding="small">
      <text wrap>{cleanedBody}</text>
      <button onPress={() =>
        context.ui.showForm(commentForm)}
      >
        Continue the Story!
      </button>
    </vstack>
  );
};

Devvit.addCustomPostType({
  name: 'Comment Form',
  render: CommentApp,
  height: 'tall'
});

export default Devvit;
