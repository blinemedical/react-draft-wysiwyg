import React, { PropTypes, Component } from 'react';
import classNames from 'classnames';
import addMention from '../addMention';
import KeyDownHandler from '../../../event-handler/keyDown';
import SuggestionHandler from '../../../event-handler/suggestions';
import styles from './styles.css'; // eslint-disable-line no-unused-vars

let config = {
  separator: undefined,
  trigger: undefined,
  suggestions: undefined,
  onChange: undefined,
  getEditorState: undefined,
  getWrapperRef: undefined,
  dropdownClassName: undefined,
  optionClassName: undefined,
  modalHandler: undefined,
};

function configDefined() {
  return config.suggestions && config.suggestions.length > 0 &&
    config.onChange && config.getEditorState;
}

function findSuggestionEntities(contentBlock, callback) {
  if (configDefined() && config.getEditorState()) {
    const selection = config.getEditorState().getSelection();

    if (selection.get('anchorKey') === contentBlock.get('key') &&
      selection.get('anchorKey') === selection.get('focusKey')) {
      let text = contentBlock.getText();
      text = text.substr(
        0,
        selection.get('focusOffset') === text.length - 1
        ? text.length
        : selection.get('focusOffset') - 1
      );
      let index = text.lastIndexOf(config.separator + config.trigger);
      let preText = config.separator + config.trigger;
      if ((index === undefined || index < 0) && text[0] === config.trigger) {
        index = 0;
        preText = config.trigger;
      }
      if (index >= 0) {
        const mentionText = text.substr(index + preText.length, text.length);
        const suggestionPresent =
          config.suggestions.some(suggestion =>
            suggestion.value && suggestion.value.indexOf(mentionText) >= 0);
        if (suggestionPresent) {
          callback(index === 0 ? 0 : index + 1, text.length);
        }
      }
    }
  }
}

class Suggestion extends Component {

  static propTypes = {
    children: PropTypes.array,
  };

  state: Object = {
    style: { left: 15 },
    activeOption: -1,
    showSuggestions: true,
  };

  componentDidMount() {
    const editorRect = config.getWrapperRef().getBoundingClientRect();
    const suggestionRect = this.suggestion.getBoundingClientRect();
    const dropdownRect = this.dropdown.getBoundingClientRect();
    let left;
    let right;
    let bottom;
    if (editorRect.width < (suggestionRect.left - editorRect.left) + dropdownRect.width) {
      right = 15;
    } else {
      left = 15;
    }
    if (editorRect.bottom < dropdownRect.bottom) {
      bottom = 0;
    }
    this.setState({ // eslint-disable-line react/no-did-mount-set-state
      style: { left, right, bottom },
    });
    KeyDownHandler.registerCallBack(this.onEditorKeyDown);
    SuggestionHandler.open();
    config.modalHandler.setSuggestionCallback(this.closeSuggestionDropdown);
    this.filterSuggestions(this.props);
  }

  componentWillReceiveProps(props) {
    if (this.props.children !== props.children) {
      this.filterSuggestions(props);
      this.setState({
        showSuggestions: true,
      });
    }
  }

  componentWillUnmount() {
    KeyDownHandler.deregisterCallBack(this.onEditorKeyDown);
    SuggestionHandler.close();
    config.modalHandler.removeSuggestionCallback();
  }

  onEditorKeyDown = (event) => {
    const { activeOption } = this.state;
    const newState = {};
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (activeOption === this.filteredSuggestions.length - 1) {
        newState.activeOption = 0;
      } else {
        newState.activeOption = activeOption + 1;
      }
    } else if (event.key === 'ArrowUp') {
      if (activeOption <= 0) {
        newState.activeOption = this.filteredSuggestions.length - 1;
      } else {
        newState.activeOption = activeOption - 1;
      }
    } else if (event.key === 'Escape') {
      newState.showSuggestions = false;
      SuggestionHandler.close();
    } else if (event.key === 'Enter') {
      this.addMention();
    }
    this.setState(newState);
  }

  onOptionMouseEnter = (index) => {
    this.setState({
      activeOption: index,
    });
  }

  onOptionMouseLeave = () => {
    this.setState({
      activeOption: -1,
    });
  }

  setSuggestionReference: Function = (ref: Object): void => {
    this.suggestion = ref;
  };

  setDropdownReference: Function = (ref: Object): void => {
    this.dropdown = ref;
  };

  closeSuggestionDropdown: Function = (): void => {
    this.setState({
      showSuggestions: false,
    });
  }

  filteredSuggestions = [];

  filterSuggestions = (props) => {
    const mentionText = props.children[0].props.text.substr(1);
    const { suggestions } = config;
    this.filteredSuggestions =
      suggestions && suggestions.filter(suggestion =>
      (!mentionText || mentionText.length === 0) ||
      (suggestion.value && suggestion.value.indexOf(mentionText) >= 0));
  }

  addMention = () => {
    const { activeOption } = this.state;
    const editorState = config.getEditorState();
    const { onChange, separator, trigger } = config;
    addMention(editorState, onChange, separator, trigger, this.filteredSuggestions[activeOption]);
  }

  render() {
    const { children } = this.props;
    const { activeOption, showSuggestions } = this.state;
    const { dropdownClassName, optionClassName } = config;
    return (
      <span
        className="rdw-suggestion-wrapper"
        ref={this.setSuggestionReference}
        onClick={config.modalHandler.onSuggestionClick}
      >
        <span>{children}</span>
        {showSuggestions &&
          <span
            className={classNames('rdw-suggestion-dropdown', dropdownClassName)}
            contentEditable="false"
            style={this.state.style}
            ref={this.setDropdownReference}
          >
            {this.filteredSuggestions.map((suggestion, index) =>
              <span
                key={index}
                spellCheck={false}
                onClick={this.addMention}
                onMouseEnter={this.onOptionMouseEnter.bind(this, index)}
                onMouseLeave={this.onOptionMouseLeave}
                className={classNames(
                  'rdw-suggestion-option',
                  optionClassName,
                  { 'rdw-suggestion-option-active': (index === activeOption) }
                )}
              >
                {suggestion.text}
              </span>)}
          </span>}
      </span>
    );
  }
}

function setConfig(conf) {
  config = { ...config, ...conf };
}

module.exports = {
  suggestionDecorator: {
    strategy: findSuggestionEntities,
    component: Suggestion,
  },
  setSuggestionConfig: setConfig,
};

// change html / markdown generators to use data from entity
