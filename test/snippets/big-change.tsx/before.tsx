import cn from 'classnames';
import {diffLines} from 'diff';
import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import * as shiki from 'shiki';
import {Citation} from '~common/messaging/modules/aichat/aichat-protocol';
import {CitationItem} from './CitationItem';
import styles from './PreCodeSnippet.scss';
import {_Context} from './PreCodeSnippetContext';
import {ShikiLanguage, useResolvedCodeLanguage} from './useResolvedCodeLanguage';

const DIFF_COLLAPSE_NEIGHBORING_LINES = 3;
const TERMINAL_COMMAND_LANGUAGES = new Set<ShikiLanguage>(['bash', 'sh', 'shell', 'zsh']);

type AwesomeComponentProps = {
  code: string;
  diffAgainstCode?: string;
  borderless?: boolean;
  noToolbar?: boolean;
  lang?: string;
  lineNumbers?: boolean;
  citations?: Citation[];
  startCollapsed?: boolean;
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
  borderless,
  lang,
  lineNumbers,
  citations,
  startCollapsed,
  noToolbar,
  onInsertCode,
  onCopyCode,
  onTerminalExecute,
  className,
  ...props
}: AwesomeComponentProps) {
  return (
    <div
      className={cn(className, styles.codeSnippet, {
        [styles.isCollapsed]: isCollapsed,
        [styles.isBorderless]: !!borderless,
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
          <span>
            Suggested code may be subject to a license:
            {sanitizedCitations.map((citation: Citation, idx: number) => (
              <React.Fragment key={idx}>
              &nbsp;&nbsp;
              <CitationItem citation={citation} />
              </React.Fragment>
            ))}
          </span>
        )}
      </div>

      {!isCollapsed && !noToolbar && (
        <div className={styles.codeSnippetToolbar}>
          TODO: put stuff here
        </div>
      )}
    </div>
  );
}