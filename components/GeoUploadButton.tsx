/**
 * GeoUploadButton component - placeholder for future geo upload functionality
 * This component is not currently used in the application
 * To implement: Set up backend API for shapefile processing
 */

export default function GeoUploadButton() {
    return (
        <button
            type="button"
            disabled
            className="border border-black/10 rounded-md px-3 py-2 font-bold text-[12px] bg-gray-200 text-gray-500 cursor-not-allowed"
            title="Geo upload functionality not available in local mode"
        >
            + Geo ZIP (Disabled)
        </button>
    );
}
