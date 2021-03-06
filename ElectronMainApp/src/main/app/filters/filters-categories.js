const subscriptions = require('./subscriptions');
const tagService = require('./filters-tags');
const config = require('config');
const collections = require('../utils/collections');
const {app} = require('electron');

/**
 * Filter categories service
 */
module.exports = (() => {

    'use strict';

    /**
     * @returns {Array.<*>} filters
     */
    const getFilters = () => {
        const result = subscriptions.getFilters().filter(f => !f.removed);

        const tags = tagService.getTags();

        result.forEach(f => {
            f.tagsDetails = [];
            f.tags.forEach(tagId => {
                const tagDetails = tags.find(tag => tag.tagId === tagId);

                if (tagDetails) {
                    if (tagDetails.keyword.startsWith('reference:')) {
                        // Hide 'reference:' tags
                        return;
                    }

                    if (!tagDetails.keyword.startsWith('lang:')) {
                        // Hide prefixes except of 'lang:'
                        tagDetails.keyword = tagDetails.keyword.substring(tagDetails.keyword.indexOf(':') + 1);
                    }

                    f.tagsDetails.push(tagDetails);
                }
            });
        });

        return result;
    };

    /**
     * Selects filters by groupId
     *
     * @param groupId
     * @param filters
     * @returns {{recommendedFilters, otherFilters: *}}
     */
    const selectFiltersByGroupId = (groupId, filters) => {
        return filters.filter(filter => filter.groupId === groupId);
    };

    /**
     * Constructs filters metadata for options.html page
     *
     * @returns {{filters: Array.<*>, categories: Array}}
     */
    const getFiltersMetadata = () => {
        const groupsMeta = subscriptions.getGroups();
        const filters = getFilters();

        const categories = [];

        for (let i = 0; i < groupsMeta.length; i++) {
            const category = groupsMeta[i];
            category.filters = selectFiltersByGroupId(category.groupId, filters);
            categories.push(category);
        }

        return {
            filters: getFilters(),
            categories: categories
        };
    };

    const checkMobile = (filter) => {
        const isMobileFilter = tagService.isMobileFilter(filter);

        if (!isMobileFilter) {
            return true;
        }

        if (typeof navigator !== 'undefined' && navigator.userAgent) {
            const isMobileDevice = navigator.userAgent.match(/iPhone|iPad|iPod/i);
            return isMobileFilter && isMobileDevice;
        }

        return false;
    };

    // https://github.com/AdguardTeam/AdGuardForSafari/issues/57
    const isOfferedFilter = (filter, langSuitableFilters, safariFilterId) => {
        // we always enable safari filter in safari extension
        if (safariFilterId === filter.filterId) {
            return true;
        }

        // if filter doesn't has recommended tag we don't enable it
        if (!tagService.isRecommendedFilter(filter)) {
            return false;
        }

        // if filter has language we check if languages are suitable for user locale
        if (filter.languages && filter.languages.length > 0) {
            if (langSuitableFilters.includes(filter.filterId)) {
                // in the end we check if filter is created for mobile device
                return checkMobile(filter);
            } else {
                return false;
            }
        }

        return checkMobile(filter);
    };

    /**
     * @param groupId
     * @returns {Array} recommended filters by groupId
     */
    const getRecommendedFilterIdsByGroupId = groupId => {
        const metadata = getFiltersMetadata();
        const filtersId = config.get('AntiBannerFiltersId');
        const langSuitableFilters = subscriptions.getFilterIdsForLanguage(app.getLocale());

        const result = [];
        for (let i = 0; i < metadata.categories.length; i += 1) {
            const category = metadata.categories[i];
            if (category.groupId === groupId) {
                category.filters.forEach(filter => {
                    if (isOfferedFilter(filter, langSuitableFilters, filtersId.SAFARI_FILTER_ID)) {
                        result.push(filter.filterId);
                    }
                });

                return result;
            }
        }

        return result;
    };

    return {
        getFiltersMetadata: getFiltersMetadata,
        getRecommendedFilterIdsByGroupId: getRecommendedFilterIdsByGroupId
    };
})();

