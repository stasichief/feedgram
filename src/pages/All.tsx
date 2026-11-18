import { Component } from 'inferno';
import { FeedPage, PageHeader, RefreshButton } from './FeedPage';
import type { Feed, Post, SortMode } from '../lib/types';

export interface AllProps {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  posts: Post[];
  feeds: Feed[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  showComments: boolean;
}

/** All — every known post from every feed, including explore feeds. */
export class All extends Component<AllProps> {
  render() {
    const {
      sort,
      onSort,
      posts,
      feeds,
      loading,
      error,
      onRefresh,
      showComments,
    } = this.props;

    return (
      <FeedPage
        feeds={feeds}
        sort={sort}
        onSort={onSort}
        posts={posts}
        loading={loading}
        error={error}
        onRetry={onRefresh}
        onRefresh={onRefresh}
        emptyTitle="No posts yet"
        emptyMessage="Once you subscribe to feeds, every post shows up here."
        emptyIcon="globe"
        showComments={showComments}
        header={
          <PageHeader
            title="All"
            subtitle={`${feeds.length} feeds · ${posts.length} posts`}
            action={<RefreshButton onClick={onRefresh} busy={loading} />}
          />
        }
      />
    );
  }
}
