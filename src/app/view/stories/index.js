import React from 'react';
import { storiesOf, action, linkTo } from '@kadira/storybook';
import Copy from '../Copy';
import BadCopy from '../BadCopy';
import YarisugiCopy from '../YarisugiCopy';

const TestSkipDecorator = (story) => {
  if(process.env.NODE_ENV === 'test'){
    return <div>Test Skip</div>
  }
  return story()
}

storiesOf('Randomtag', module)
  .addDecorator(TestSkipDecorator)
  .add('Copy', () => (
    <Copy
      onClick={action('onclick')}
      tags={["foo", "baz", "bar"]}
      onCopySuccess={action('copySuccess')}
    />
  ))
  .add('BadCopy', () => (
    <BadCopy
      onClick={action('onclick')}
      tags={["foo", "baz", "bar"]}
      onCopySuccess={action('copySuccess')}
    />
  ))
  .add('YarisugiCopy', () => (
    <YarisugiCopy
      onClick={action('onclick')}
      tags={["foo", "baz", "bar"]}
      onCopySuccess={action('copySuccess')}
    />
  ));
