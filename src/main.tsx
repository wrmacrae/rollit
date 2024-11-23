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

Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {
    const post = (await context.reddit.getPostById(event.comment?.postId!))
    const chapter = getChapterOfTitle(post.title)
    const comments = await post.comments.all()
    if (totalScoreOfComments(comments) < chapter) {
      return
    }

    const comment = randomCommentByScoreWeight(comments)
    const title = incrementChapterOfTitle(post.title)
    const body = `${post.body}\n\n${comment?.body}`;
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