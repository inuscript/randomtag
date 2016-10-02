import React from 'react';
import { storiesOf, action, linkTo } from '@kadira/storybook';
import Copy from '../Copy';

storiesOf('Randomtag', module)
  .add('Copy', () => (
    <Copy
      onClick={action('onclick')}
      tags={["foo", "baz", "bar"]}
      onCopySuccess={action('copySuccess')}
    />
  ));
