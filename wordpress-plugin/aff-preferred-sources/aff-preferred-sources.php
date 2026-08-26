<?php
/**
 * Plugin Name:       Add to Preferred Sources (Google)
 * Description:       Adds Google's official "Add to Preferred Sources" badge to the site. Auto-inserts after post content, and provides the [preferred_source] shortcode for manual placement.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            aiforfreelancers.net
 * License:           GPL-2.0-or-later
 * Text Domain:       aff-preferred-sources
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class AFF_Preferred_Sources {

	const SDK_URL     = 'https://news.google.com/swg/js/v1/publisher.js';
	const OPTION_KEY  = 'aff_preferred_sources_settings';

	/** @var bool Set once a badge has actually been printed on this request. */
	private $rendered = false;

	public static function boot() {
		$instance = new self();
		add_action( 'wp_enqueue_scripts', array( $instance, 'enqueue' ) );
		add_shortcode( 'preferred_source', array( $instance, 'shortcode' ) );
		add_filter( 'the_content', array( $instance, 'auto_insert' ), 20 );
		add_action( 'admin_menu', array( $instance, 'add_settings_page' ) );
		add_action( 'admin_init', array( $instance, 'register_settings' ) );
	}

	/* ---------------------------------------------------------------- settings */

	public function settings() {
		$defaults = array(
			'auto_insert' => 1,       // append the badge under single post content
			'post_types'  => array( 'post' ),
			'theme'       => 'auto',  // auto | light | dark
			'heading'     => __( 'Enjoying this? Get more of it in your Google results.', 'aff-preferred-sources' ),
		);

		$saved = get_option( self::OPTION_KEY, array() );

		return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
	}

	/* ------------------------------------------------------------------ assets */

	/**
	 * Google's SDK must load from their origin; it renders the badge into an
	 * iframe, which is why the badge itself cannot be restyled from our CSS.
	 */
	public function enqueue() {
		wp_enqueue_script(
			'google-swg-publisher',
			self::SDK_URL,
			array(),
			null,
			array(
				'strategy'  => 'async',
				'in_footer' => false,
			)
		);

		$css = '
.aff-preferred-source{display:flex;flex-direction:column;align-items:flex-start;gap:.6rem;margin:2rem 0;min-height:44px}
.aff-preferred-source__heading{margin:0;font-size:.95rem;line-height:1.4;font-weight:600;opacity:.85}
.aff-preferred-source--center{align-items:center;text-align:center}
.aff-preferred-source noscript a{font-size:.95rem}
';
		wp_register_style( 'aff-preferred-sources', false, array(), '1.0.0' );
		wp_enqueue_style( 'aff-preferred-sources' );
		wp_add_inline_style( 'aff-preferred-sources', $css );
	}

	/* ------------------------------------------------------------------ markup */

	/**
	 * @param array $args align (left|center), heading (string|''), theme.
	 */
	public function render( $args = array() ) {
		$settings = $this->settings();

		$args = wp_parse_args(
			$args,
			array(
				'align'   => 'left',
				'heading' => $settings['heading'],
				'theme'   => $settings['theme'],
			)
		);

		$classes = 'aff-preferred-source';
		if ( 'center' === $args['align'] ) {
			$classes .= ' aff-preferred-source--center';
		}

		$badge_attrs = '';
		if ( in_array( $args['theme'], array( 'light', 'dark' ), true ) ) {
			$badge_attrs .= ' data-theme="' . esc_attr( $args['theme'] ) . '"';
		}

		$fallback_url = add_query_arg(
			'q',
			rawurlencode( wp_parse_url( home_url(), PHP_URL_HOST ) ),
			'https://www.google.com/preferences/source'
		);

		ob_start();
		?>
		<div class="<?php echo esc_attr( $classes ); ?>">
			<?php if ( '' !== trim( (string) $args['heading'] ) ) : ?>
				<p class="aff-preferred-source__heading"><?php echo esc_html( $args['heading'] ); ?></p>
			<?php endif; ?>

			<div google-add-preferred-source-btn<?php echo $badge_attrs; // phpcs:ignore WordPress.Security.EscapeOutput ?>></div>

			<noscript>
				<a href="<?php echo esc_url( $fallback_url ); ?>" rel="noopener">
					<?php esc_html_e( 'Add this site as a preferred source on Google', 'aff-preferred-sources' ); ?>
				</a>
			</noscript>
		</div>
		<?php
		$this->rendered = true;

		return ob_get_clean();
	}

	public function shortcode( $atts ) {
		$atts = shortcode_atts(
			array(
				'align'   => 'left',
				'heading' => $this->settings()['heading'],
				'theme'   => $this->settings()['theme'],
			),
			$atts,
			'preferred_source'
		);

		return $this->render( $atts );
	}

	/**
	 * Append the badge to single posts. Skips feeds, excerpts, archives and any
	 * post that already places the badge by shortcode.
	 */
	public function auto_insert( $content ) {
		$settings = $this->settings();

		if ( empty( $settings['auto_insert'] ) ) {
			return $content;
		}

		if ( ! is_singular() || ! in_the_loop() || ! is_main_query() || is_feed() ) {
			return $content;
		}

		if ( ! in_array( get_post_type(), (array) $settings['post_types'], true ) ) {
			return $content;
		}

		if ( $this->rendered || has_shortcode( $content, 'preferred_source' ) ) {
			return $content;
		}

		return $content . $this->render( array( 'align' => 'left' ) );
	}

	/* ------------------------------------------------------------- admin screen */

	public function add_settings_page() {
		add_options_page(
			__( 'Preferred Sources', 'aff-preferred-sources' ),
			__( 'Preferred Sources', 'aff-preferred-sources' ),
			'manage_options',
			'aff-preferred-sources',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings() {
		register_setting(
			'aff_preferred_sources',
			self::OPTION_KEY,
			array( 'sanitize_callback' => array( $this, 'sanitize' ) )
		);
	}

	public function sanitize( $input ) {
		$public_types = get_post_types( array( 'public' => true ) );

		$types = isset( $input['post_types'] ) ? (array) $input['post_types'] : array();
		$types = array_values( array_intersect( $types, $public_types ) );

		$theme = isset( $input['theme'] ) ? $input['theme'] : 'auto';
		if ( ! in_array( $theme, array( 'auto', 'light', 'dark' ), true ) ) {
			$theme = 'auto';
		}

		return array(
			'auto_insert' => empty( $input['auto_insert'] ) ? 0 : 1,
			'post_types'  => $types,
			'theme'       => $theme,
			'heading'     => isset( $input['heading'] ) ? sanitize_text_field( $input['heading'] ) : '',
		);
	}

	public function render_settings_page() {
		$settings = $this->settings();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Add to Preferred Sources', 'aff-preferred-sources' ); ?></h1>
			<p>
				<?php esc_html_e( 'Shows Google\'s official badge so readers can mark this site as a preferred source. Use the shortcode [preferred_source] to place it anywhere manually.', 'aff-preferred-sources' ); ?>
			</p>

			<form method="post" action="options.php">
				<?php settings_fields( 'aff_preferred_sources' ); ?>
				<table class="form-table" role="presentation">

					<tr>
						<th scope="row"><?php esc_html_e( 'Automatic placement', 'aff-preferred-sources' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[auto_insert]" value="1" <?php checked( $settings['auto_insert'], 1 ); ?> />
								<?php esc_html_e( 'Show the badge at the end of single posts', 'aff-preferred-sources' ); ?>
							</label>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Apply to', 'aff-preferred-sources' ); ?></th>
						<td>
							<?php foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $type ) : ?>
								<label style="display:block;margin-bottom:4px">
									<input type="checkbox"
										name="<?php echo esc_attr( self::OPTION_KEY ); ?>[post_types][]"
										value="<?php echo esc_attr( $type->name ); ?>"
										<?php checked( in_array( $type->name, (array) $settings['post_types'], true ) ); ?> />
									<?php echo esc_html( $type->labels->name ); ?>
								</label>
							<?php endforeach; ?>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="aff-ps-heading"><?php esc_html_e( 'Prompt text', 'aff-preferred-sources' ); ?></label></th>
						<td>
							<input id="aff-ps-heading" type="text" class="regular-text"
								name="<?php echo esc_attr( self::OPTION_KEY ); ?>[heading]"
								value="<?php echo esc_attr( $settings['heading'] ); ?>" />
							<p class="description"><?php esc_html_e( 'Line shown above the badge. Leave empty to show the badge alone.', 'aff-preferred-sources' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><label for="aff-ps-theme"><?php esc_html_e( 'Badge theme', 'aff-preferred-sources' ); ?></label></th>
						<td>
							<select id="aff-ps-theme" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[theme]">
								<option value="auto" <?php selected( $settings['theme'], 'auto' ); ?>><?php esc_html_e( 'Auto', 'aff-preferred-sources' ); ?></option>
								<option value="light" <?php selected( $settings['theme'], 'light' ); ?>><?php esc_html_e( 'Light background', 'aff-preferred-sources' ); ?></option>
								<option value="dark" <?php selected( $settings['theme'], 'dark' ); ?>><?php esc_html_e( 'Dark background', 'aff-preferred-sources' ); ?></option>
							</select>
						</td>
					</tr>

				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}

AFF_Preferred_Sources::boot();
