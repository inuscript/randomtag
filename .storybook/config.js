import { configure } from '@kadira/storybook';

function loadStories() {
  require('../src/app/view/stories');
}

configure(loadStories, module);
