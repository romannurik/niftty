import cn from 'classnames';
import {diffLines} from 'diff';
import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Icon} from 'react-shared/components/Icon';
import {IconButton} from 'react-shared/components/IconButton';
import {Label} from 'react-shared/components/Text';
import * as shiki from 'shiki';
import {Citation} from '~common/messaging/modules/aichat/aichat-protocol';
import {CitationItem} from './CitationItem';
import styles from './PreCodeSnippet.scss';
import {_Context} from './PreCodeSnippetContext';
import {ShikiLanguage, useResolvedCodeLanguage} from './useResolvedCodeLanguage';

const DIFF_COLLAPSE_NEIGHBORING_LINES = 3;
const TERMINAL_COMMAND_LANGUAGES = new Set<ShikiLanguage>(['bash', 'sh', 'shell', 'zsh']);

type Props = {
  code: string;
  diffAgainstCode?: string;
  noToolbar?: boolean;
  lang?: string;
  lineNumbers?: boolean;
  citations?: Citation[];
  onInsertCode?: () => void;
  onCopyCode?: () => void;
  onTerminalExecute?: () => void;
  className?: string;
};

type DiffInfo = {
  combinedCode: string;
  lineOptions: {
    type: 'same' | 'removed' | 'added';
    collapse?: boolean;
    collapseRangeCommonLinesMarker?: number;
    classes: string[];
    oldLineNumber?: number;
    newLineNumber?: number;
  }[];
};

export function PreCodeSnippet({
  code,
  diffAgainstCode,
  lang,
  lineNumbers,
  citations,
  noToolbar,
  onInsertCode,
  onCopyCode,
  onTerminalExecute,
  className,
  ...props
}: Props) {
  return (
    <div
      className={cn(className, styles.codeSnippet, {
        [styles.isDiff]: !!diffInfo,
      })}
      onClick={!isCollapsed ? undefined : () => setCollapsed(false)}
    >
      <div className={styles.preContainer}>
        <pre ref={preNode} {...props}>
          {diffInfo?.combinedCode ?? code}
        </pre>
        {!isCollapsed && isCollapsible && (
          <a
            className={styles.collapseLink}
            href="#"
            role="button"
            onClick={ev => {
              ev.preventDefault();
              setCollapsed(true);
            }}
          >
            See less
          </a>
        )}
        {!!sanitizedCitations.length && (
          <>
            <Label level={3} secondary className={styles.citations}>
              <Icon icon="tag" />
              <span>
                Suggested code may be subject to a license:
                {sanitizedCitations.map((citation: Citation, idx: number) => (
                  <React.Fragment key={idx}>
                    &nbsp;&nbsp;&middot;
                    <CitationItem citation={citation} />
                  </React.Fragment>
                ))}
              </span>
            </Label>
          </>
        )}
      </div>

      {!isCollapsed && !noToolbar && (
        <div className={styles.codeSnippetToolbar}>
          <Label level={4}>
            {resolvedLang}
            {isAutodetectedLang && ' (auto)'}
          </Label>
          {isTerminalCommand && onTerminalExecute && (
            <IconButton
              tooltip="Run Command in Terminal"
              icon="play"
              onClick={() => onTerminalExecute()}
            />
          )}
          {onInsertCode && (
            <IconButton tooltip="Insert Code" icon="insert" onClick={() => onInsertCode()} />
          )}
          {onCopyCode && (
            <IconButton
              tooltip="Copy to Clipboard"
              icon="copy"
              onClick={() => {
                onCopyCode?.();
                navigator.clipboard.writeText(code);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}