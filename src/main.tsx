import { Comment, Context, Devvit, Listing, Post, RichTextBuilder } from '@devvit/public-api';

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

export default Devvit;