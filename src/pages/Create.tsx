import { Component } from 'inferno';
import { Redirect } from 'inferno-router';
import { CreatePost } from '../components/Create/CreatePost';
import type { AuthSession } from '../lib/types';

export interface CreateProps {
  sessions: AuthSession[];
}

/**
 * Create post page.
 * Redirects to the profile when no account is connected.
 */
export class Create extends Component<CreateProps> {
  render() {
    const { sessions } = this.props;

    if (sessions.length === 0) {
      return <Redirect to="/profile" />;
    }

    return <CreatePost sessions={sessions} />;
  }
}
