import { html as beautifyHtml, type HTMLBeautifyOptions } from 'js-beautify';

const DEFAULT_HTML_FORMAT_OPTIONS: HTMLBeautifyOptions = {
  indent_size: 2,
  indent_char: ' ',
  indent_inner_html: true,
  preserve_newlines: true,
  max_preserve_newlines: 2,
  wrap_line_length: 0,
  content_unformatted: [],
  end_with_newline: false,
};

export function formatHtml(html: string): string {
  return beautifyHtml(html, DEFAULT_HTML_FORMAT_OPTIONS);
}
