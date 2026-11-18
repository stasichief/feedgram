import { Component } from 'inferno';
import { PostDetail } from '../components/Feed/PostDetail';
import { CommentsPanel } from '../components/Feed/CommentsPanel';
import { LoadingState, ErrorState } from '../components/Feed/PostList';
import { PageHeader } from './FeedPage';
import { getFeed, getPost } from '../lib/db';
import type { Feed, Post } from '../lib/types';

export interface PostPageProps {
  match: { params: { id?: string } };
  showComments: boolean;
}

/** Standalone post route — `/post/:id`. */
export class PostPage extends Component<PostPageProps> {
  private post: Post | null = null;
  private feed: Feed | null = null;
  private loading = true;
  private error = '';

  componentDidMount(): void {
    this.scrollToTop();
    void this.load();
  }

  componentDidUpdate(previousProps: PostPageProps): void {
    if (previousProps.match.params.id !== this.props.match.params.id) {
      this.scrollToTop();
      void this.load();
    }
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  private async load(): Promise<void> {
    const encodedId = this.props.match.params.id;
    if (!encodedId) {
      this.error = 'No post id was provided.';
      this.loading = false;
      this.forceUpdate();
      return;
    }

    let id: string;
    try {
      id = decodeURIComponent(encodedId);
    } catch {
      this.error = 'The post link is invalid.';
      this.loading = false;
      this.forceUpdate();
      return;
    }

    this.loading = true;
    this.error = '';
    this.forceUpdate();

    try {
      const post = await getPost(id);
      if (!post) {
        this.error = 'That post is not in the cache.';
      } else {
        this.post = post;
        this.feed = (await getFeed(post.feedId)) ?? null;
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Could not load the post.';
    } finally {
      this.loading = false;
      this.forceUpdate();
    }
  }

  render() {
    const { showComments } = this.props;

    if (this.loading) return <LoadingState label="Loading post…" />;
    if (this.error || !this.post) {
      return <ErrorState message={this.error || 'Post not found.'} />;
    }

    return (
      <div>
        <PageHeader title={this.post.title} />
        <PostDetail
          postId={this.post.id}
          url={this.post.url}
          title={this.post.title}
          contentHtml={this.post.contentHtml}
          inline={this.post.inline}
          thumbnail={this.post.thumbnail}
          onClose={() => history.back()}
        />
        {showComments && this.feed ? (
          <CommentsPanel
            postId={this.post.id}
            postUrl={this.post.url}
            remoteId={this.post.remoteId}
            feed={this.feed}
          />
        ) : null}
      </div>
    );
  }
}
