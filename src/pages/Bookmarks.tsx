import { Component } from 'inferno';
import { FeedPage, PageHeader } from './FeedPage';
import type { Feed, Post, SortMode } from '../lib/types';

export interface BookmarksProps {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  posts: Post[];
  feeds: Feed[];
  loading: boolean;
  error: string;
  showComments: boolean;
  onFeedsChanged?: () => void;
}

/** Bookmarks — every post the user has saved locally. */
export class Bookmarks extends Component<BookmarksProps> {
  render() {
    const {
      sort,
      onSort,
      posts,
      feeds,
      loading,
      error,
      showComments,
      onFeedsChanged,
    } = this.props;

    return (
      <FeedPage
        feeds={feeds}
        sort={sort}
        onSort={onSort}
        posts={posts}
        loading={loading}
        error={error}
        emptyTitle="No bookmarks yet"
        emptyMessage="Tap Save on any post to keep it here for later."
        emptyIcon="bookmark"
        showComments={showComments}
        onFeedsChanged={onFeedsChanged}
        header={
          <PageHeader
            title="Bookmarks"
            subtitle={
              posts.length === 0
                ? 'Nothing saved'
                : `${posts.length} saved post${posts.length === 1 ? '' : 's'}`
            }
          />
        }
      />
    );
  }
}
